import type { ExerciseMetric, WorkoutSet } from '../../shared/types.ts';
import { formatDuration, formatKg } from './stats.ts';

export interface Suggestion {
  /** Short form for lists, e.g. "77.5 kg". */
  short: string;
  /** Full sentence for the logger. */
  detail: string;
  /** Pre-filled sets for the next session. */
  sets: WorkoutSet[];
}

/** Rep window for double progression: build reps to the top, then add load and drop back down. */
const REP_FLOOR = 6;
const REP_CEILING = 10;
const BODYWEIGHT_CEILING = 15;

const increment = (kg: number) => (kg >= 40 ? 2.5 : 2);
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

function loaded(sets: WorkoutSet[], ceiling: number, prefix = ''): Suggestion {
  const top = Math.max(...sets.map((s) => s.weight));
  const working = sets.filter((s) => s.weight === top);
  const minReps = Math.min(...working.map((s) => s.reps));
  const kg = (n: number) => `${prefix}${formatKg(n)}`;

  if (minReps >= ceiling) {
    const next = top + increment(top);
    return {
      short: kg(next),
      detail: `You hit ${minReps}+ reps on every set at ${kg(top)} — go up to ${kg(next)}.`,
      sets: sets.map((s) => ({ ...s, weight: s.weight === top ? next : s.weight, reps: Math.max(REP_FLOOR, s.reps - 2) })),
    };
  }
  if (minReps >= REP_FLOOR) {
    return {
      short: `${kg(top)} × ${minReps + 1}`,
      detail: `Stay at ${kg(top)} and aim for ${minReps + 1} reps on every set.`,
      sets: sets.map((s) => (s.weight === top ? { ...s, reps: Math.max(s.reps, minReps + 1) } : s)),
    };
  }
  return {
    short: `${kg(top)} × ${REP_FLOOR}`,
    detail: `Hold ${kg(top)} until every set reaches ${REP_FLOOR} reps.`,
    sets,
  };
}

/** What to aim for next time, based on the most recent session of an exercise. */
export function suggestNext(last: WorkoutSet[], metric: ExerciseMetric): Suggestion | null {
  if (last.length === 0) return null;
  const anyWeight = last.some((s) => s.weight > 0);

  if (metric === 'time') {
    const min = Math.min(...last.map((s) => s.seconds ?? 0));
    const next = roundTo(min + 10, 5);
    return {
      short: formatDuration(next),
      detail: `Your shortest hold was ${formatDuration(min)} — aim for ${formatDuration(next)} on every set.`,
      sets: last.map((s) => ({ ...s, seconds: Math.max(s.seconds ?? 0, next) })),
    };
  }

  if (metric === 'bodyweight' && !anyWeight) {
    const minReps = Math.min(...last.map((s) => s.reps));
    if (minReps >= BODYWEIGHT_CEILING) {
      return {
        short: '+2.5 kg',
        detail: `${minReps}+ reps on every set — time to add 2.5 kg.`,
        sets: last.map((s) => ({ ...s, weight: 2.5, reps: Math.max(REP_FLOOR, s.reps - 4) })),
      };
    }
    return {
      short: `${minReps + 1} reps`,
      detail: `Aim for ${minReps + 1}+ reps on every set.`,
      sets: last.map((s) => ({ ...s, reps: Math.max(s.reps, minReps + 1) })),
    };
  }

  return loaded(last, metric === 'bodyweight' ? BODYWEIGHT_CEILING - 3 : REP_CEILING, metric === 'bodyweight' ? '+' : '');
}
