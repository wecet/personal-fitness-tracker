import type { MuscleId } from './muscles.ts';

/** How an exercise is measured: reps × kg, bodyweight reps (optional added kg), or a timed hold. */
export type ExerciseMetric = 'weight' | 'bodyweight' | 'time';

export const EXERCISE_METRICS: ExerciseMetric[] = ['weight', 'bodyweight', 'time'];

export interface Exercise {
  id: number;
  name: string;
  muscle: MuscleId;
  secondary: MuscleId[];
  metric: ExerciseMetric;
  custom: boolean;
}

export interface NewExercise {
  name: string;
  muscle: MuscleId;
  secondary?: MuscleId[];
  metric?: ExerciseMetric;
}

export interface WorkoutSet {
  /** 0 for timed sets. */
  reps: number;
  /** Kilograms (added weight for bodyweight/timed exercises). */
  weight: number;
  /** Duration of a timed set. */
  seconds?: number;
}

export interface Entry {
  id: string;
  exerciseId: number;
  /** ISO timestamp. */
  performedAt: string;
  sets: WorkoutSet[];
  note: string | null;
}

export type FootballType = 'match' | 'training' | 'futsal' | 'drills';

export const FOOTBALL_TYPES: FootballType[] = ['match', 'training', 'futsal', 'drills'];

export interface Activity {
  id: string;
  type: FootballType;
  performedAt: string;
  minutes: number;
  /** Session effort, 1–10. */
  rpe: number;
  note: string | null;
}

/** Singleton record (id "settings"). Weekdays are 0 = Sunday … 6 = Saturday. */
export interface Settings {
  id: 'settings';
  matchDays: number[];
  trainingDays: number[];
}

export const DEFAULT_SETTINGS: Settings = { id: 'settings', matchDays: [6], trainingDays: [2, 5] };

/**
 * Every user record kind. Records carry a client-generated string id so they
 * can be created offline and synced later; a put with an existing id overwrites.
 */
export interface RecordMap {
  entry: Entry;
  activity: Activity;
  settings: Settings;
}

export type RecordKind = keyof RecordMap;

const KINDS: Record<RecordKind, true> = { entry: true, activity: true, settings: true };
export const RECORD_KINDS = Object.keys(KINDS) as RecordKind[];

export type Records = { [K in RecordKind]: RecordMap[K][] };

export const emptyRecords = (): Records =>
  Object.fromEntries(RECORD_KINDS.map((k) => [k, []])) as unknown as Records;

export type SyncOp = {
  [K in RecordKind]: { op: 'put'; kind: K; record: RecordMap[K] } | { op: 'delete'; kind: K; id: string };
}[RecordKind];

export interface AppState {
  exercises: Exercise[];
  records: Records;
}

export interface SyncResult {
  state: AppState;
  rejected: { op: SyncOp; error: string }[];
}
