import type { MuscleId } from './muscles.ts';

export interface Exercise {
  id: number;
  name: string;
  muscle: MuscleId;
  secondary: MuscleId[];
  custom: boolean;
}

export interface WorkoutSet {
  reps: number;
  /** Kilograms. 0 for bodyweight. */
  weight: number;
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
}
