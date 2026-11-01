import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { backups } from './backup.ts';
import { openDb } from './db.ts';

const root = mkdtempSync(join(tmpdir(), 'tempo-test-'));
after(() => rmSync(root, { recursive: true, force: true }));
let n = 0;
const fresh = () => openDb(join(root, `db-${++n}`, 'fitness.db'));

const bench = (db: ReturnType<typeof fresh>) => db.state().exercises.find((e) => e.name === 'Barbell Bench Press')!;
const putEntry = (exerciseId: number, sets: unknown, id = 'e1') => ({
  op: 'put', kind: 'entry', record: { id, exerciseId, performedAt: '2026-11-01T10:00:00Z', sets, note: null },
});

describe('database', () => {
  it('seeds the exercise library', () => {
    const db = fresh();
    assert.ok(db.state().exercises.length > 50);
    assert.ok(bench(db));
  });

  it('stores valid records and reports invalid ones without blocking the rest', () => {
    const db = fresh();
    const { state, rejected } = db.sync([
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
    db.sync([putEntry(id, [{ reps: 8, weight: 80 }])]);
    db.sync([putEntry(id, [{ reps: 9, weight: 80 }])]);
    assert.equal(db.state().records.entry[0].sets[0].reps, 9);
    db.sync([{ op: 'delete', kind: 'entry', id: 'e1' }]);
    assert.equal(db.state().records.entry.length, 0);
  });

  it('validates injuries, including return-to-play stages', () => {
    const db = fresh();
    const injury = { id: 'i1', area: 'chest', side: 'left', startedAt: '2026-10-24', resolvedAt: null, context: 'gym', note: null };
    const ok = db.sync([{ op: 'put', kind: 'injury', record: { ...injury, stage: 2 } }]);
    assert.equal(ok.state.records.injury[0].stage, 2);
    const legacy = db.sync([{ op: 'put', kind: 'injury', record: injury }]);
    assert.equal(legacy.state.records.injury[0].stage, 0);
    const bad = db.sync([
      { op: 'put', kind: 'injury', record: { ...injury, id: 'i2', stage: 12 } },
      { op: 'put', kind: 'injury', record: { ...injury, id: 'i3', resolvedAt: '2026-10-01' } },
      { op: 'put', kind: 'injury', record: { ...injury, id: 'i4', area: 'spleen' } },
    ]);
    assert.equal(bad.rejected.length, 3);
  });

  it('adds custom exercises and refuses duplicates', () => {
    const db = fresh();
    const ex = db.addExercise({ name: 'Landmine Press', muscle: 'shoulders' });
    assert.equal(ex.custom, true);
    assert.throws(() => db.addExercise({ name: 'landmine press', muscle: 'chest' }));
  });
});

describe('backups', () => {
  it('writes a readable copy of the database', async () => {
    const db = fresh();
    db.sync([putEntry(bench(db).id, [{ reps: 8, weight: 80 }])]);
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
