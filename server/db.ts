import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { EXERCISE_LIBRARY } from '../shared/exerciseLibrary.ts';
import type { Entry, Exercise, NewEntry, NewExercise } from '../shared/types.ts';

export type Db = ReturnType<typeof openDb>;

interface ExerciseRow {
  id: number;
  name: string;
  muscle: string;
  secondary: string;
  custom: number;
}

interface EntryRow {
  id: number;
  exercise_id: number;
  performed_at: string;
  sets: string;
  note: string | null;
}

const toExercise = (r: ExerciseRow): Exercise => ({
  id: r.id,
  name: r.name,
  muscle: r.muscle as Exercise['muscle'],
  secondary: JSON.parse(r.secondary),
  custom: r.custom === 1,
});

const toEntry = (r: EntryRow): Entry => ({
  id: r.id,
  exerciseId: r.exercise_id,
  performedAt: r.performed_at,
  sets: JSON.parse(r.sets),
  note: r.note,
});

export function openDb(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      muscle TEXT NOT NULL,
      secondary TEXT NOT NULL DEFAULT '[]',
      custom INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      performed_at TEXT NOT NULL,
      sets TEXT NOT NULL,
      note TEXT
    );
    CREATE INDEX IF NOT EXISTS entries_performed_at ON entries(performed_at);
  `);

  const seed = db.prepare('INSERT OR IGNORE INTO exercises (name, muscle, secondary) VALUES (?, ?, ?)');
  for (const [name, muscle, secondary] of EXERCISE_LIBRARY) {
    seed.run(name, muscle, JSON.stringify(secondary));
  }

  const getExercise = db.prepare('SELECT * FROM exercises WHERE id = ?');
  const getEntry = db.prepare('SELECT * FROM entries WHERE id = ?');

  return {
    state() {
      return {
        exercises: (db.prepare('SELECT * FROM exercises ORDER BY name').all() as unknown as ExerciseRow[]).map(toExercise),
        entries: (db.prepare('SELECT * FROM entries ORDER BY performed_at').all() as unknown as EntryRow[]).map(toEntry),
      };
    },

    exerciseExists(id: number) {
      return getExercise.get(id) !== undefined;
    },

    addExercise(input: NewExercise): Exercise {
      const { lastInsertRowid } = db
        .prepare('INSERT INTO exercises (name, muscle, secondary, custom) VALUES (?, ?, ?, 1)')
        .run(input.name, input.muscle, JSON.stringify(input.secondary ?? []));
      return toExercise(getExercise.get(lastInsertRowid) as unknown as ExerciseRow);
    },

    addEntry(input: NewEntry): Entry {
      const { lastInsertRowid } = db
        .prepare('INSERT INTO entries (exercise_id, performed_at, sets, note) VALUES (?, ?, ?, ?)')
        .run(input.exerciseId, input.performedAt, JSON.stringify(input.sets), input.note ?? null);
      return toEntry(getEntry.get(lastInsertRowid) as unknown as EntryRow);
    },

    deleteEntry(id: number) {
      return db.prepare('DELETE FROM entries WHERE id = ?').run(id).changes > 0;
    },
  };
}
