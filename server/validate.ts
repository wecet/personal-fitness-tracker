import { EXERCISE_KINDS, EXERCISE_METRICS, FOOTBALL_TYPES, INJURY_CONTEXTS, JOINT_AREAS, type Exercise, type ExerciseMetric, type Injury, type NewExercise, type RecordKind, type RecordMap, type WorkoutSet } from '../shared/types.ts';
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

function localDate(value: unknown, name: string): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fail(`${name} must be YYYY-MM-DD`);
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
  const kind = EXERCISE_KINDS.find((k) => k === body.kind) ?? 'strength';
  return { name, muscle: body.muscle, secondary, metric, kind };
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
        sessionId: r.sessionId == null ? null : recordId(r.sessionId),
      };
    },
    session(raw) {
      const r = object(raw);
      return {
        id: recordId(r.id),
        startedAt: isoDate(r.startedAt, 'startedAt'),
        endedAt: r.endedAt == null ? null : isoDate(r.endedAt, 'endedAt'),
        rpe: r.rpe == null ? null : int(r.rpe, 'rpe', 1, 10),
        note: note(r.note),
        routineId: r.routineId == null ? null : recordId(r.routineId),
      };
    },
    bodyweight(raw) {
      const r = object(raw);
      const date = localDate(r.date, 'date');
      const kg = Number(r.kg);
      if (!Number.isFinite(kg) || kg < 20 || kg > 400) fail('kg must be 20–400');
      return { id: recordId(r.id), date, kg: Math.round(kg * 10) / 10 };
    },
    injury(raw) {
      const r = object(raw);
      const area = isMuscleId(r.area) || JOINT_AREAS.some((a) => a === r.area) ? (r.area as Injury['area']) : fail('Unknown injury area');
      const startedAt = localDate(r.startedAt, 'startedAt');
      const resolvedAt = r.resolvedAt == null ? null : localDate(r.resolvedAt, 'resolvedAt');
      if (resolvedAt && resolvedAt < startedAt) fail('An injury can’t resolve before it started');
      return {
        id: recordId(r.id),
        area,
        side: r.side === 'left' || r.side === 'right' || r.side === 'both' ? r.side : null,
        startedAt,
        resolvedAt,
        context: INJURY_CONTEXTS.find((c) => c === r.context) ?? 'other',
        note: note(r.note),
      };
    },
    routine(raw) {
      const r = object(raw);
      const name = typeof r.name === 'string' ? r.name.trim().slice(0, 60) : '';
      if (!name) fail('Routine name is required');
      if (!Array.isArray(r.items) || r.items.length === 0 || r.items.length > 30) fail('A routine needs 1–30 exercises');
      const items = (r.items as unknown[]).map((raw) => {
        const item = object(raw);
        const exercise = getExercise(Number(item.exerciseId)) ?? fail('Unknown exercise');
        return { exerciseId: exercise.id, sets: sets(item.sets, exercise.metric) };
      });
      return { id: recordId(r.id), name, items, createdAt: isoDate(r.createdAt, 'createdAt') };
    },
    soreness(raw) {
      const r = object(raw);
      const muscles: Record<string, 1 | 2> = {};
      for (const [m, level] of Object.entries(object(r.muscles))) {
        if (!isMuscleId(m)) fail('Unknown muscle');
        if (level !== 1 && level !== 2) fail('Soreness level must be 1 or 2');
        muscles[m] = level as 1 | 2;
      }
      return { id: recordId(r.id), recordedAt: isoDate(r.recordedAt, 'recordedAt'), muscles };
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
      return {
        id: 'settings',
        matchDays: weekdays(r.matchDays),
        trainingDays: weekdays(r.trainingDays),
        restSeconds: r.restSeconds == null ? 90 : int(r.restSeconds, 'restSeconds', 15, 600),
      };
    },
  };
}
