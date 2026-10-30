import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { EXERCISE_LIBRARY } from '../shared/exerciseLibrary.ts';
import { emptyRecords, type AppState, type Exercise, type NewExercise, type RecordKind, type SyncOp, type SyncResult } from '../shared/types.ts';
import { makeValidators, object, recordId, ValidationError } from './validate.ts';

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

function migrate(db: DatabaseSync) {
  const columns = db.prepare('PRAGMA table_info(exercises)').all() as unknown as { name: string }[];
  if (!columns.some((c) => c.name === 'metric')) {
    db.exec("ALTER TABLE exercises ADD COLUMN metric TEXT NOT NULL DEFAULT 'weight'");
  }
  if (!columns.some((c) => c.name === 'kind')) {
    db.exec("ALTER TABLE exercises ADD COLUMN kind TEXT NOT NULL DEFAULT 'strength'");
  }

  // v1 kept entries in their own table with integer ids; move them into the record store.
  const legacy = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'entries'").get();
  if (legacy) {
    db.exec('BEGIN');
    const rows = db.prepare('SELECT * FROM entries').all() as unknown as {
      id: number; exercise_id: number; performed_at: string; sets: string; note: string | null;
    }[];
    const insert = db.prepare("INSERT OR IGNORE INTO records (id, kind, data, updated_at) VALUES (?, 'entry', ?, ?)");
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

export function openDb(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      muscle TEXT NOT NULL,
      secondary TEXT NOT NULL DEFAULT '[]',
      metric TEXT NOT NULL DEFAULT 'weight',
      kind TEXT NOT NULL DEFAULT 'strength',
      custom INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS records_kind ON records(kind);
  `);
  migrate(db);

  // Library exercises are kept in sync with the code; custom ones are left alone.
  const seed = db.prepare(`
    INSERT INTO exercises (name, muscle, secondary, metric, kind) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET muscle = excluded.muscle, secondary = excluded.secondary, metric = excluded.metric, kind = excluded.kind
    WHERE custom = 0
  `);
  for (const [name, muscle, secondary, metric = 'weight', kind = 'strength'] of EXERCISE_LIBRARY) {
    seed.run(name, muscle, JSON.stringify(secondary), metric, kind);
  }

  const getExerciseStmt = db.prepare('SELECT * FROM exercises WHERE id = ?');
  const getExercise = (id: number) => {
    const row = getExerciseStmt.get(id) as unknown as ExerciseRow | undefined;
    return row && toExercise(row);
  };
  const validators = makeValidators(getExercise);
  const putStmt = db.prepare(`
    INSERT INTO records (id, kind, data, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at WHERE kind = excluded.kind
  `);
  const deleteStmt = db.prepare('DELETE FROM records WHERE id = ? AND kind = ?');

  function state(): AppState {
    const records = emptyRecords();
    const rows = db.prepare('SELECT kind, data FROM records').all() as unknown as { kind: RecordKind; data: string }[];
    for (const r of rows) (records[r.kind] as unknown[] | undefined)?.push(JSON.parse(r.data));
    return {
      exercises: (db.prepare('SELECT * FROM exercises ORDER BY name').all() as unknown as ExerciseRow[]).map(toExercise),
      records,
    };
  }

  return {
    state,

    addExercise(input: NewExercise): Exercise {
      const { lastInsertRowid } = db
        .prepare('INSERT INTO exercises (name, muscle, secondary, metric, kind, custom) VALUES (?, ?, ?, ?, ?, 1)')
        .run(input.name, input.muscle, JSON.stringify(input.secondary ?? []), input.metric ?? 'weight', input.kind ?? 'strength');
      return getExercise(Number(lastInsertRowid))!;
    },

    /** Applies ops in order; invalid ops are skipped and reported rather than blocking the queue. */
    sync(rawOps: unknown[]): SyncResult {
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
              putStmt.run(record.id, kind, JSON.stringify(record), now);
            } else if (op.op === 'delete') {
              deleteStmt.run(recordId(op.id), kind);
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
      return { state: state(), rejected };
    },
  };
}
