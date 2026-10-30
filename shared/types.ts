import type { MuscleId } from './muscles.ts';

/** How an exercise is measured: reps × kg, bodyweight reps (optional added kg), or a timed hold. */
export type ExerciseMetric = 'weight' | 'bodyweight' | 'time';

export const EXERCISE_METRICS: ExerciseMetric[] = ['weight', 'bodyweight', 'time'];

/** Strength work builds fatigue from effort; plyometrics from ground contacts; mobility adds none. */
export type ExerciseKind = 'strength' | 'plyometric' | 'mobility';

export const EXERCISE_KINDS: ExerciseKind[] = ['strength', 'plyometric', 'mobility'];

export interface Exercise {
  id: number;
  name: string;
  muscle: MuscleId;
  secondary: MuscleId[];
  metric: ExerciseMetric;
  kind: ExerciseKind;
  custom: boolean;
}

export interface NewExercise {
  name: string;
  muscle: MuscleId;
  secondary?: MuscleId[];
  metric?: ExerciseMetric;
  kind?: ExerciseKind;
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
  /** The workout session this was logged in, if any. */
  sessionId?: string | null;
}

export interface WorkoutSession {
  id: string;
  startedAt: string;
  /** null while the workout is in progress. */
  endedAt: string | null;
  /** Session effort 1–10, asked for when finishing. */
  rpe: number | null;
  note: string | null;
  /** Set when the workout was started from a routine. */
  routineId?: string | null;
}

export interface RoutineItem {
  exerciseId: number;
  /** Planned sets; refreshed from what you did each time the routine is finished. */
  sets: WorkoutSet[];
}

export interface Routine {
  id: string;
  name: string;
  items: RoutineItem[];
  createdAt: string;
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
  /** Default rest between sets. */
  restSeconds: number;
}

export const DEFAULT_SETTINGS: Settings = { id: 'settings', matchDays: [6], trainingDays: [2, 5], restSeconds: 90 };

/** 1 = a bit sore, 2 = very sore. */
export type SorenessLevel = 1 | 2;

/** One check-in per day (id "sore-YYYY-MM-DD"); the latest replaces earlier ones. */
export interface Soreness {
  id: string;
  recordedAt: string;
  muscles: Partial<Record<MuscleId, SorenessLevel>>;
}

/** One weigh-in per day (id "bw-YYYY-MM-DD"). */
export interface BodyweightLog {
  id: string;
  /** Local date, YYYY-MM-DD. */
  date: string;
  kg: number;
}

/** Joints and regions you can hurt that aren't one of the body-map muscles. */
export type JointArea = 'knee' | 'ankle' | 'foot' | 'wrist' | 'elbow' | 'neck';

export const JOINT_AREAS: JointArea[] = ['knee', 'ankle', 'foot', 'wrist', 'elbow', 'neck'];

export type InjuryArea = MuscleId | JointArea;

export type InjurySide = 'left' | 'right' | 'both';

export type InjuryContext = 'match' | 'training' | 'gym' | 'other';

export const INJURY_CONTEXTS: InjuryContext[] = ['match', 'training', 'gym', 'other'];

export interface Injury {
  id: string;
  area: InjuryArea;
  side: InjurySide | null;
  /** Local date, YYYY-MM-DD. */
  startedAt: string;
  /** Local date you were back to full training; null while ongoing. */
  resolvedAt: string | null;
  context: InjuryContext;
  note: string | null;
}

/**
 * Every user record kind. Records carry a client-generated string id so they
 * can be created offline and synced later; a put with an existing id overwrites.
 */
export interface RecordMap {
  entry: Entry;
  activity: Activity;
  settings: Settings;
  session: WorkoutSession;
  soreness: Soreness;
  routine: Routine;
  bodyweight: BodyweightLog;
  injury: Injury;
}

export type RecordKind = keyof RecordMap;

const KINDS: Record<RecordKind, true> = { entry: true, activity: true, settings: true, session: true, soreness: true, routine: true, bodyweight: true, injury: true };
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
