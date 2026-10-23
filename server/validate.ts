import { EXERCISE_METRICS, FOOTBALL_TYPES, type Exercise, type ExerciseMetric, type NewExercise, type RecordKind, type RecordMap, type WorkoutSet } from '../shared/types.ts';
import { isMuscleId } from '../shared/muscles.ts';

export class ValidationError extends Error {}

const fail = (message: string): never => {
  throw new ValidationError(message);
};

export function object(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : fail('Expected an object');
}

export function recordId(value: unknown): string {
  return typeof value === 'string' && /^[\w-]{1,64}$/.test(value) ? value : fail('Invalid id');
}

function isoDate(value: unknown, name: string): string {
  const ms = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isNaN(ms) ? fail(`${name} must be an ISO date`) : new Date(ms).toISOString();
}

function int(value: unknown, name: string, min: number, max: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fail(`${name} must be a whole number from ${min} to ${max}`);
}

function weekdays(value: unknown): number[] {
  if (!Array.isArray(value)) return fail('Expected a list of weekdays');
  return [...new Set(value.map((d) => int(d, 'weekday', 0, 6)))].sort();
}

function note(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : null;
}

function sets(value: unknown, metric: ExerciseMetric): WorkoutSet[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) fail('sets must be a non-empty array');
  return (value as unknown[]).map((raw) => {
    const s = object(raw);
    const weight = Number(s.weight ?? 0);
    if (!Number.isFinite(weight) || weight < 0 || weight > 2000) fail('weight must be 0–2000 kg');
    const rounded = Math.round(weight * 100) / 100;
    if (metric === 'time') {
      const seconds = Number(s.seconds);
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > 36_000) fail('seconds must be a positive integer');
      return { reps: 0, weight: rounded, seconds };
    }
    const reps = Number(s.reps);
    if (!Number.isInteger(reps) || reps < 1 || reps > 1000) fail('reps must be a positive integer');
    return { reps, weight: rounded };
  });
}

export function newExercise(raw: unknown): NewExercise {
  const body = object(raw);
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  if (!name) fail('name is required');
  if (!isMuscleId(body.muscle)) return fail('Unknown muscle');
  const secondary = Array.isArray(body.secondary) ? body.secondary.filter(isMuscleId) : [];
  const metric = EXERCISE_METRICS.find((m) => m === body.metric) ?? 'weight';
  return { name, muscle: body.muscle, secondary, metric };
}

export type Validators = { [K in RecordKind]: (raw: unknown) => RecordMap[K] };

export function makeValidators(getExercise: (id: number) => Exercise | undefined): Validators {
  return {
    entry(raw) {
      const r = object(raw);
      const exercise = getExercise(Number(r.exerciseId)) ?? fail('Unknown exercise');
      return {
        id: recordId(r.id),
        exerciseId: exercise.id,
        performedAt: isoDate(r.performedAt, 'performedAt'),
        sets: sets(r.sets, exercise.metric),
        note: note(r.note),
      };
    },
    activity(raw) {
      const r = object(raw);
      return {
        id: recordId(r.id),
        type: FOOTBALL_TYPES.find((t) => t === r.type) ?? fail('Unknown activity type'),
        performedAt: isoDate(r.performedAt, 'performedAt'),
        minutes: int(r.minutes, 'minutes', 1, 300),
        rpe: int(r.rpe, 'rpe', 1, 10),
        note: note(r.note),
      };
    },
    settings(raw) {
      const r = object(raw);
      if (r.id !== 'settings') fail('Settings id must be "settings"');
      return { id: 'settings', matchDays: weekdays(r.matchDays), trainingDays: weekdays(r.trainingDays) };
    },
  };
}
