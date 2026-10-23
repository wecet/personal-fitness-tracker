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

export interface WorkoutSet {
  /** 0 for timed sets. */
  reps: number;
  /** Kilograms (added weight for bodyweight/timed exercises). */
  weight: number;
  /** Duration of a timed set. */
  seconds?: number;
}

export interface Entry {
  id: number;
  exerciseId: number;
  /** ISO timestamp. */
  performedAt: string;
  sets: WorkoutSet[];
  note: string | null;
}

export interface AppState {
  exercises: Exercise[];
  entries: Entry[];
}

export interface NewEntry {
  exerciseId: number;
  performedAt: string;
  sets: WorkoutSet[];
  note?: string | null;
}

export interface NewExercise {
  name: string;
  muscle: MuscleId;
  secondary?: MuscleId[];
  metric?: ExerciseMetric;
}
