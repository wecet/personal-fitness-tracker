import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { EXERCISE_LIBRARY } from '../shared/exerciseLibrary.ts';
import { emptyRecords, type AppState, type Exercise, type NewExercise, type RecordKind, type SyncOp, type SyncResult } from '../shared/types.ts';
import { makeValidators, object, recordId, ValidationError } from './validate.ts';

/** Owner of rows written before accounts existed; the first account to sign up claims them. */
export const UNCLAIMED = '';

interface ExerciseRow {
  id: number;
  name: string;
  muscle: string;
  secondary: string;
  metric: string;
  kind: string;
  custom: number;
}

const toExercise = (r: ExerciseRow): Exercise => ({
  id: r.id,
  name: r.name,
  muscle: r.muscle as Exercise['muscle'],
  secondary: JSON.parse(r.secondary),
  metric: r.metric as Exercise['metric'],
  kind: r.kind as Exercise['kind'],
  custom: r.custom === 1,
});

const columnsOf = (db: DatabaseSync, table: string) =>
  (db.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[]).map((c) => c.name);

function migrate(db: DatabaseSync) {
  const columns = columnsOf(db, 'exercises');
  if (!columns.includes('metric')) {
    db.exec("ALTER TABLE exercises ADD COLUMN metric TEXT NOT NULL DEFAULT 'weight'");
  }
  if (!columns.includes('kind')) {
    db.exec("ALTER TABLE exercises ADD COLUMN kind TEXT NOT NULL DEFAULT 'strength'");
  }

  // Accounts: custom exercises get an owner (library ones have none), and names only
  // need to be unique per owner. SQLite can't drop a constraint, so rebuild the table.
  if (!columns.includes('owner')) {
    db.exec('BEGIN');
    db.exec(`
      CREATE TABLE exercises_new (${EXERCISE_COLUMNS});
      INSERT INTO exercises_new (id, owner, name, muscle, secondary, metric, kind, custom)
        SELECT id, CASE WHEN custom = 1 THEN '${UNCLAIMED}' END, name, muscle, secondary, metric, kind, custom FROM exercises;
      DROP TABLE exercises;
      ALTER TABLE exercises_new RENAME TO exercises;
    `);
    db.exec('COMMIT');
  }

  // Accounts: every record belongs to someone. Ids are unique per owner.
  if (!columnsOf(db, 'records').includes('user_id')) {
    db.exec('BEGIN');
    db.exec(`
      CREATE TABLE records_new (${RECORD_COLUMNS});
      INSERT INTO records_new (user_id, id, kind, data, updated_at) SELECT '${UNCLAIMED}', id, kind, data, updated_at FROM records;
      DROP TABLE records;
      ALTER TABLE records_new RENAME TO records;
    `);
    db.exec('COMMIT');
  }

  // v1 kept entries in their own table with integer ids; move them into the record store.
  const legacy = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'entries'").get();
  if (legacy) {
    db.exec('BEGIN');
    const rows = db.prepare('SELECT * FROM entries').all() as unknown as {
      id: number; exercise_id: number; performed_at: string; sets: string; note: string | null;
    }[];
    const insert = db.prepare(`INSERT OR IGNORE INTO records (user_id, id, kind, data, updated_at) VALUES ('${UNCLAIMED}', ?, 'entry', ?, ?)`);
    for (const r of rows) {
      const id = `legacy-${r.id}`;
      const entry = { id, exerciseId: r.exercise_id, performedAt: r.performed_at, sets: JSON.parse(r.sets), note: r.note };
      insert.run(id, JSON.stringify(entry), new Date().toISOString());
    }
    db.exec('ALTER TABLE entries RENAME TO entries_legacy');
    db.exec('COMMIT');
    console.log(`Migrated ${rows.length} entries to the record store`);
  }
}

const EXERCISE_COLUMNS = `
  id INTEGER PRIMARY KEY,
  owner TEXT,
  name TEXT NOT NULL COLLATE NOCASE,
  muscle TEXT NOT NULL,
  secondary TEXT NOT NULL DEFAULT '[]',
  metric TEXT NOT NULL DEFAULT 'weight',
  kind TEXT NOT NULL DEFAULT 'strength',
  custom INTEGER NOT NULL DEFAULT 0
`;
const RECORD_COLUMNS = `
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  kind TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
`;

export function openDb(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS exercises (${EXERCISE_COLUMNS});
    CREATE TABLE IF NOT EXISTS records (${RECORD_COLUMNS});
  `);
  migrate(db);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS exercises_owner_name ON exercises(ifnull(owner, ''), name);
    CREATE INDEX IF NOT EXISTS records_user_kind ON records(user_id, kind);
  `);

  // Library exercises are kept in sync with the code; custom ones are left alone.
  const updateLibrary = db.prepare('UPDATE exercises SET muscle = ?, secondary = ?, metric = ?, kind = ? WHERE owner IS NULL AND name = ?');
  const insertLibrary = db.prepare('INSERT INTO exercises (owner, name, muscle, secondary, metric, kind) VALUES (NULL, ?, ?, ?, ?, ?)');
  for (const [name, muscle, secondary, metric = 'weight', kind = 'strength'] of EXERCISE_LIBRARY) {
    const values = [muscle, JSON.stringify(secondary), metric, kind] as const;
    if (Number(updateLibrary.run(...values, name).changes) === 0) insertLibrary.run(name, ...values);
  }

  /** Library exercises plus this person's own. */
  const visibleExercise = db.prepare('SELECT * FROM exercises WHERE id = ? AND (owner IS NULL OR owner = ?)');
  const getExercise = (userId: string, id: number) => {
    const row = visibleExercise.get(id, userId) as unknown as ExerciseRow | undefined;
    return row && toExercise(row);
  };
  const putStmt = db.prepare(`
    INSERT INTO records (user_id, id, kind, data, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at WHERE kind = excluded.kind
  `);
  const deleteStmt = db.prepare('DELETE FROM records WHERE user_id = ? AND id = ? AND kind = ?');

  function state(userId: string): AppState {
    const records = emptyRecords();
    const rows = db.prepare('SELECT kind, data FROM records WHERE user_id = ?').all(userId) as unknown as { kind: RecordKind; data: string }[];
    for (const r of rows) (records[r.kind] as unknown[] | undefined)?.push(JSON.parse(r.data));
    const exercises = db.prepare('SELECT * FROM exercises WHERE owner IS NULL OR owner = ? ORDER BY name').all(userId) as unknown as ExerciseRow[];
    return { exercises: exercises.map(toExercise), records };
  }

  return {
    /** The open connection, for backups and accounts. */
    handle: db,
    state,

    /** Hands everything from before accounts to the first person to sign up. */
    claimUnowned(userId: string) {
      db.prepare('UPDATE records SET user_id = ? WHERE user_id = ?').run(userId, UNCLAIMED);
      db.prepare('UPDATE exercises SET owner = ? WHERE owner = ?').run(userId, UNCLAIMED);
    },

    addExercise(userId: string, input: NewExercise): Exercise {
      const clash = db.prepare('SELECT 1 FROM exercises WHERE name = ? AND (owner IS NULL OR owner = ?)').get(input.name, userId);
      if (clash) throw new ValidationError('An exercise with that name already exists');
      const { lastInsertRowid } = db
        .prepare('INSERT INTO exercises (owner, name, muscle, secondary, metric, kind, custom) VALUES (?, ?, ?, ?, ?, ?, 1)')
        .run(userId, input.name, input.muscle, JSON.stringify(input.secondary ?? []), input.metric ?? 'weight', input.kind ?? 'strength');
      return getExercise(userId, Number(lastInsertRowid))!;
    },

    /** Applies ops in order; invalid ops are skipped and reported rather than blocking the queue. */
    sync(userId: string, rawOps: unknown[]): SyncResult {
      const validators = makeValidators((id) => getExercise(userId, id));
      const rejected: SyncResult['rejected'] = [];
      const now = new Date().toISOString();
      db.exec('BEGIN');
      try {
        for (const raw of rawOps) {
          try {
            const op = object(raw);
            const kind = op.kind as RecordKind;
            if (!(kind in validators)) throw new ValidationError('Unknown record kind');
            if (op.op === 'put') {
              const record = validators[kind](op.record);
              putStmt.run(userId, record.id, kind, JSON.stringify(record), now);
            } else if (op.op === 'delete') {
              deleteStmt.run(userId, recordId(op.id), kind);
            } else {
              throw new ValidationError('Unknown op');
            }
          } catch (err) {
            if (!(err instanceof ValidationError)) throw err;
            rejected.push({ op: raw as SyncOp, error: err.message });
          }
        }
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      return { state: state(userId), rejected };
    },
  };
}
