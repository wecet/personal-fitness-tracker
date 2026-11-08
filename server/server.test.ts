import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:net';
import { accounts, limiter } from './accounts.ts';
import { backups } from './backup.ts';
import { openDb, UNCLAIMED } from './db.ts';
import { buildMessage, sendMail } from './mail.ts';

const root = mkdtempSync(join(tmpdir(), 'tempo-test-'));
after(() => rmSync(root, { recursive: true, force: true }));
let n = 0;
const fresh = () => openDb(join(root, `db-${++n}`, 'fitness.db'));

const U = 'user-1';
const bench = (db: ReturnType<typeof fresh>) => db.state(U).exercises.find((e) => e.name === 'Barbell Bench Press')!;
const putEntry = (exerciseId: number, sets: unknown, id = 'e1') => ({
  op: 'put', kind: 'entry', record: { id, exerciseId, performedAt: '2026-11-01T10:00:00Z', sets, note: null },
});

describe('database', () => {
  it('seeds the exercise library', () => {
    const db = fresh();
    assert.ok(db.state(U).exercises.length > 50);
    assert.ok(bench(db));
  });

  it('stores valid records and reports invalid ones without blocking the rest', () => {
    const db = fresh();
    const { state, rejected } = db.sync(U, [
      putEntry(bench(db).id, [{ reps: 8, weight: 80 }]),
      putEntry(bench(db).id, [{ reps: -1, weight: 80 }], 'bad-reps'),
      putEntry(99999, [{ reps: 8, weight: 80 }], 'bad-exercise'),
      { op: 'put', kind: 'nonsense', record: {} },
    ]);
    assert.equal(state.records.entry.length, 1);
    assert.equal(rejected.length, 3);
  });

  it('overwrites on put and removes on delete', () => {
    const db = fresh();
    const id = bench(db).id;
    db.sync(U, [putEntry(id, [{ reps: 8, weight: 80 }])]);
    db.sync(U, [putEntry(id, [{ reps: 9, weight: 80 }])]);
    assert.equal(db.state(U).records.entry[0].sets[0].reps, 9);
    db.sync(U, [{ op: 'delete', kind: 'entry', id: 'e1' }]);
    assert.equal(db.state(U).records.entry.length, 0);
  });

  it('validates injuries, including return-to-play stages', () => {
    const db = fresh();
    const injury = { id: 'i1', area: 'chest', side: 'left', startedAt: '2026-10-24', resolvedAt: null, context: 'gym', note: null };
    const ok = db.sync(U, [{ op: 'put', kind: 'injury', record: { ...injury, stage: 2 } }]);
    assert.equal(ok.state.records.injury[0].stage, 2);
    const legacy = db.sync(U, [{ op: 'put', kind: 'injury', record: injury }]);
    assert.equal(legacy.state.records.injury[0].stage, 0);
    const bad = db.sync(U, [
      { op: 'put', kind: 'injury', record: { ...injury, id: 'i2', stage: 12 } },
      { op: 'put', kind: 'injury', record: { ...injury, id: 'i3', resolvedAt: '2026-10-01' } },
      { op: 'put', kind: 'injury', record: { ...injury, id: 'i4', area: 'spleen' } },
    ]);
    assert.equal(bad.rejected.length, 3);
  });

  it('keeps supersets as pairs and stores the morning check-in', () => {
    const db = fresh();
    const ids = db.state(U).exercises.slice(0, 4).map((e) => e.id);
    const sets = [{ reps: 8, weight: 20 }];
    const items = ids.map((exerciseId) => ({ exerciseId, sets, supersetNext: true }));
    const { state } = db.sync(U, [
      { op: 'put', kind: 'routine', record: { id: 'r1', name: 'Pairs', items, createdAt: '2026-11-01T10:00:00Z' } },
      { op: 'put', kind: 'soreness', record: { id: 'sore-2026-11-01', recordedAt: '2026-11-01T07:00:00Z', muscles: {}, sleep: 1, energy: 3 } },
    ]);
    // A chain of four becomes two pairs, and the last exercise can't pair with nothing.
    assert.deepEqual(state.records.routine[0].items.map((i) => !!i.supersetNext), [true, false, true, false]);
    assert.equal(state.records.soreness[0].sleep, 1);
    const bad = db.sync(U, [
      { op: 'put', kind: 'soreness', record: { id: 'sore-2026-11-02', recordedAt: '2026-11-02T07:00:00Z', muscles: {}, sleep: 7 } },
    ]);
    assert.equal(bad.rejected.length, 1);
  });

  it('adds custom exercises and refuses duplicates', () => {
    const db = fresh();
    const ex = db.addExercise(U, { name: 'Landmine Press', muscle: 'shoulders' });
    assert.equal(ex.custom, true);
    assert.throws(() => db.addExercise(U, { name: 'landmine press', muscle: 'chest' }));
    assert.throws(() => db.addExercise(U, { name: 'Barbell Bench Press', muscle: 'chest' }), /already exists/);
  });
});

describe('accounts', () => {
  const setup = () => {
    const db = fresh();
    return { db, users: accounts(db.handle, { onFirstUser: (id) => db.claimUnowned(id) }) };
  };

  it('upgrades a single-user database, keeping everything for the first account', async () => {
    const dir = join(root, 'legacy');
    const path = join(dir, 'fitness.db');
    mkdirSync(dir);
    const old = new DatabaseSync(path);
    old.exec(`
      CREATE TABLE exercises (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, muscle TEXT NOT NULL,
        secondary TEXT NOT NULL DEFAULT '[]', metric TEXT NOT NULL DEFAULT 'weight', kind TEXT NOT NULL DEFAULT 'strength', custom INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL);
      INSERT INTO exercises (id, name, muscle, custom) VALUES (1, 'Barbell Bench Press', 'chest', 0), (500, 'Landmine Press', 'shoulders', 1);
      INSERT INTO records VALUES ('e1', 'entry', '{"id":"e1","exerciseId":500,"performedAt":"2026-10-01T10:00:00Z","sets":[{"reps":8,"weight":20}],"note":null}', '2026-10-01T10:00:00Z');
    `);
    old.close();

    const db = openDb(path);
    const users = accounts(db.handle, { onFirstUser: (id) => db.claimUnowned(id) });
    const { user } = await users.signUp('owen@example.com', 'secret password');
    const state = db.state(user.id);
    assert.equal(state.records.entry.length, 1);
    assert.equal(state.records.entry[0].exerciseId, 500, 'exercise ids are kept');
    assert.ok(state.exercises.some((e) => e.id === 500 && e.custom));
    assert.equal(state.exercises.filter((e) => e.name === 'Barbell Bench Press').length, 1, 'library not duplicated');
    assert.equal(db.state('someone-else').records.entry.length, 0);
  });

  it('keeps each person’s records and custom exercises to themselves', () => {
    const db = fresh();
    db.sync('a', [putEntry(bench(db).id, [{ reps: 8, weight: 80 }], 'same-id')]);
    db.sync('b', [putEntry(bench(db).id, [{ reps: 5, weight: 100 }], 'same-id')]);
    assert.equal(db.state('a').records.entry[0].sets[0].weight, 80);
    assert.equal(db.state('b').records.entry[0].sets[0].weight, 100);
    db.sync('b', [{ op: 'delete', kind: 'entry', id: 'same-id' }]);
    assert.equal(db.state('a').records.entry.length, 1);

    const mine = db.addExercise('a', { name: 'Landmine Press', muscle: 'shoulders' });
    assert.ok(db.state('a').exercises.some((e) => e.id === mine.id));
    assert.ok(!db.state('b').exercises.some((e) => e.id === mine.id));
    // Someone else can use the same name, but not log against another person's exercise.
    db.addExercise('b', { name: 'Landmine Press', muscle: 'shoulders' });
    assert.equal(db.sync('b', [putEntry(mine.id, [{ reps: 8, weight: 20 }], 'sneaky')]).rejected.length, 1);
  });

  it('signs up, signs in, and gives the first account the data from before accounts', async () => {
    const { db, users } = setup();
    db.sync(UNCLAIMED, [putEntry(bench(db).id, [{ reps: 8, weight: 80 }])]);
    const first = await users.signUp('Owen@Example.com ', 'correct horse');
    assert.equal(first.user.email, 'owen@example.com');
    assert.equal(db.state(first.user.id).records.entry.length, 1);

    const second = await users.signUp('friend@example.com', 'another one');
    assert.equal(db.state(second.user.id).records.entry.length, 0);
    await assert.rejects(users.signUp('OWEN@example.com', 'whatever123'), /already exists/);
    await assert.rejects(users.signUp('not-an-email', 'whatever123'), /valid email/);
    await assert.rejects(users.signUp('short@example.com', 'short'), /at least 8/);

    const login = await users.logIn('owen@example.com', 'correct horse');
    assert.equal(users.session(login.session.token)!.user.id, first.user.id);
    await assert.rejects(users.logIn('owen@example.com', 'wrong password'), /don’t match/);
    await assert.rejects(users.logIn('nobody@example.com', 'correct horse'), /don’t match/);
  });

  it('stores only hashes of passwords and session tokens', async () => {
    const { db, users } = setup();
    const { session } = await users.signUp('a@example.com', 'secret password');
    const dump = JSON.stringify(db.handle.prepare('SELECT * FROM users').all()) + JSON.stringify(db.handle.prepare('SELECT * FROM sessions').all());
    assert.ok(!dump.includes('secret password'));
    assert.ok(!dump.includes(session.token));
  });

  it('ends sessions on log out and when they expire, and extends active ones', async () => {
    const { users } = setup();
    const { session } = await users.signUp('a@example.com', 'secret password');
    const now = Date.now();
    assert.equal(users.session(session.token, now)!.renewed, undefined);
    assert.ok(users.session(session.token, now + 40 * 86_400_000)!.renewed, 'renewed when getting old');
    assert.equal(users.session(session.token, now + 200 * 86_400_000), null);
    const again = await users.logIn('a@example.com', 'secret password');
    users.logOut(again.session.token);
    assert.equal(users.session(again.session.token), null);
    assert.equal(users.session('made-up'), null);
  });

  it('resets a password once with the newest link, and signs out every device', async () => {
    const { users } = setup();
    const { session } = await users.signUp('a@example.com', 'old password');
    assert.equal(users.requestReset('nobody@example.com'), null);
    const stale = users.requestReset('A@example.com')!;
    const reset = users.requestReset('a@example.com')!;
    await assert.rejects(users.resetPassword(stale.token, 'new password'), /expired or was already used/);
    await assert.rejects(users.resetPassword(reset.token, 'short'), /at least 8/);
    const done = await users.resetPassword(reset.token, 'new password');
    assert.equal(users.session(session.token), null, 'old devices are signed out');
    assert.ok(users.session(done.session.token));
    await assert.rejects(users.resetPassword(reset.token, 'newer password'), /already used/);
    await assert.rejects(users.logIn('a@example.com', 'old password'));
    assert.ok(await users.logIn('a@example.com', 'new password'));
  });

  it('refuses a reset link after an hour', async () => {
    const { users } = setup();
    await users.signUp('a@example.com', 'old password');
    const reset = users.requestReset('a@example.com', Date.now() - 61 * 60_000)!;
    await assert.rejects(users.resetPassword(reset.token, 'new password'), /expired/);
  });

  it('limits attempts within a window', () => {
    const l = limiter(2, 1000);
    assert.deepEqual([l.allow('k', 0), l.allow('k', 10), l.allow('k', 20), l.allow('k', 1500)], [true, true, false, true]);
    l.clear('k');
    assert.ok(l.allow('k', 1510));
  });
});

describe('mail', () => {
  it('speaks enough SMTP to deliver a message', async () => {
    const received: string[] = [];
    const server = createServer((socket) => {
      socket.write('220 fake ready\r\n');
      let data = false;
      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk;
        let i;
        while ((i = buffer.indexOf('\r\n')) >= 0) {
          const line = buffer.slice(0, i);
          buffer = buffer.slice(i + 2);
          received.push(line);
          if (data) {
            if (line === '.') { data = false; socket.write('250 queued\r\n'); }
            continue;
          }
          if (line.startsWith('EHLO')) socket.write('250-fake\r\n250 AUTH PLAIN\r\n');
          else if (line.startsWith('AUTH PLAIN')) socket.write('235 ok\r\n');
          else if (line.startsWith('MAIL') || line.startsWith('RCPT')) socket.write('250 ok\r\n');
          else if (line === 'DATA') { data = true; socket.write('354 go\r\n'); }
          else if (line === 'QUIT') socket.end('221 bye\r\n');
        }
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as { port: number }).port;
    try {
      await sendMail(
        { host: '127.0.0.1', port, secure: false, user: 'me@gmail.com', pass: 'app password', from: 'Tempo <me@gmail.com>' },
        { to: 'you@example.com', subject: 'Hi', text: 'Hello\n.hidden dot', html: '<p>Hello</p>' },
      );
    } finally {
      server.close();
    }
    assert.ok(received.includes(`AUTH PLAIN ${Buffer.from('\0me@gmail.com\0app password').toString('base64')}`));
    assert.ok(received.includes('MAIL FROM:<me@gmail.com>'));
    assert.ok(received.includes('RCPT TO:<you@example.com>'));
    assert.ok(received.includes('..hidden dot'), 'a leading dot is doubled');
  });

  it('refuses header injection', () => {
    assert.throws(() => buildMessage('Tempo <a@b.c>', { to: 'x@y.z\r\nBcc: evil@z.z', subject: 's', text: 't', html: 'h' }));
  });
});

describe('backups', () => {
  it('writes a readable copy of the database', async () => {
    const db = fresh();
    db.sync(U, [putEntry(bench(db).id, [{ reps: 8, weight: 80 }])]);
    const dir = join(root, 'backups-1');
    const b = backups(db.handle, dir, { now: () => new Date('2026-11-01T03:00:00Z') });
    assert.equal(b.status().latest, null);
    const file = await b.run();
    assert.equal(file, 'fitness-2026-11-01.db');
    const copy = new DatabaseSync(join(dir, file), { readOnly: true });
    const rows = copy.prepare("SELECT count(*) AS n FROM records WHERE kind = 'entry'").get() as { n: number };
    copy.close();
    assert.equal(rows.n, 1);
    assert.equal(b.status().count, 1);
  });

  it('makes one copy a day and keeps only the newest', async () => {
    const db = fresh();
    const dir = join(root, 'backups-2');
    let day = 1;
    const b = backups(db.handle, dir, { keep: 3, now: () => new Date(Date.UTC(2026, 10, day, 3)) });
    for (; day <= 5; day++) {
      await b.tick();
      await b.tick(); // a second check the same day does nothing
    }
    assert.deepEqual(b.list(), ['fitness-2026-11-03.db', 'fitness-2026-11-04.db', 'fitness-2026-11-05.db']);
  });

  it('leaves other files in the folder alone and no temp files behind', async () => {
    const db = fresh();
    const dir = join(root, 'backups-3');
    const b = backups(db.handle, dir, { keep: 1, now: () => new Date('2026-11-01T03:00:00Z') });
    writeFileSync(join(dir, 'notes.txt'), 'keep me');
    await b.run();
    assert.deepEqual(readdirSync(dir).sort(), ['fitness-2026-11-01.db', 'notes.txt']);
  });
});
