import { MUSCLE_BY_ID } from '../../shared/muscles.ts';
import type { Entry, Exercise, WorkoutSet } from '../../shared/types.ts';
import { formatDuration, formatKg } from './stats.ts';

/*
 * Double progression with the "2-for-2" rule: raise the load once you can do
 * the top of the rep range on every working set in two consecutive sessions,
 * by ~2.5% for upper-body and ~5% for lower-body lifts (ACSM, 2009, "Progression
 * models in resistance training for healthy adults", Med Sci Sports Exerc
 * 41:687–708, which recommends 2–10% increases).
 */

export interface Suggestion {
  /** Short form for lists, e.g. "77.5 kg". */
  short: string;
  /** Full sentence for the logger. */
  detail: string;
  /** Pre-filled sets for the next session. */
  sets: WorkoutSet[];
}

const REP_FLOOR = 6;
const REP_CEILING = 10;
const BODYWEIGHT_CEILING = 15;
const ADDED_WEIGHT_CEILING = 12;
const LOWER_BODY_JUMP = 0.05;
const UPPER_BODY_JUMP = 0.025;

const isLowerBody = (ex: Exercise) => MUSCLE_BY_ID[ex.muscle].category === 'legs' || ex.muscle === 'lowerBack';

/** Percentage jump rounded to a loadable step (2.5 kg on bars/machines, 1 kg on light dumbbells). */
function nextLoad(kg: number, lower: boolean): number {
  const step = kg >= 20 ? 2.5 : 1;
  const raw = kg * (lower ? LOWER_BODY_JUMP : UPPER_BODY_JUMP);
  return kg + Math.max(step, Math.round(raw / step) * step);
}

/** Top working weight and the fewest reps done at it. */
function working(sets: WorkoutSet[]) {
  const top = Math.max(...sets.map((s) => s.weight));
  return { top, minReps: Math.min(...sets.filter((s) => s.weight === top).map((s) => s.reps)) };
}

/** What to aim for next time, from the exercise's logged history (oldest → newest). */
export function suggestNext(history: Entry[], ex: Exercise): Suggestion | null {
  const last = history.at(-1);
  if (!last || ex.kind !== 'strength') return null;
  const prev = history.at(-2);

  if (ex.metric === 'time') {
    const min = Math.min(...last.sets.map((s) => s.seconds ?? 0));
    const next = Math.round((min * 1.1) / 5) * 5 || min + 5;
    return {
      short: formatDuration(next),
      detail: `Your shortest hold was ${formatDuration(min)} — aim for ${formatDuration(next)} (+10%) on every set.`,
      sets: last.sets.map((s) => ({ ...s, seconds: Math.max(s.seconds ?? 0, next) })),
    };
  }

  const unloaded = ex.metric === 'bodyweight' && !last.sets.some((s) => s.weight > 0);
  if (unloaded) {
    const minReps = Math.min(...last.sets.map((s) => s.reps));
    const prevMin = prev && !prev.sets.some((s) => s.weight > 0) ? Math.min(...prev.sets.map((s) => s.reps)) : 0;
    if (minReps >= BODYWEIGHT_CEILING && prevMin >= BODYWEIGHT_CEILING) {
      return {
        short: '+2.5 kg',
        detail: `${BODYWEIGHT_CEILING}+ reps on every set two sessions running — add 2.5 kg.`,
        sets: last.sets.map((s) => ({ ...s, weight: 2.5, reps: Math.max(REP_FLOOR, s.reps - 4) })),
      };
    }
    if (minReps >= BODYWEIGHT_CEILING) {
      return { short: `${minReps} reps`, detail: `Hit ${BODYWEIGHT_CEILING}+ on every set once more and it's time to add weight.`, sets: last.sets };
    }
    return {
      short: `${minReps + 1} reps`,
      detail: `Aim for ${minReps + 1}+ reps on every set.`,
      sets: last.sets.map((s) => ({ ...s, reps: Math.max(s.reps, minReps + 1) })),
    };
  }

  const ceiling = ex.metric === 'bodyweight' ? ADDED_WEIGHT_CEILING : REP_CEILING;
  const prefix = ex.metric === 'bodyweight' ? '+' : '';
  const kg = (n: number) => `${prefix}${formatKg(n)}`;
  const { top, minReps } = working(last.sets);
  const prevWork = prev && working(prev.sets);
  const hitTop = minReps >= ceiling;
  const twoInARow = hitTop && prevWork && prevWork.top === top && prevWork.minReps >= ceiling;

  if (twoInARow) {
    const next = nextLoad(top, isLowerBody(ex));
    return {
      short: kg(next),
      detail: `${ceiling}+ reps on every set at ${kg(top)} two sessions running — go up to ${kg(next)}.`,
      sets: last.sets.map((s) => ({ ...s, weight: s.weight === top ? next : s.weight, reps: Math.max(REP_FLOOR, s.reps - 2) })),
    };
  }
  if (hitTop) {
    return {
      short: `${kg(top)} × ${ceiling}`,
      detail: `${ceiling}+ reps on every set at ${kg(top)} — do it once more, then add weight.`,
      sets: last.sets,
    };
  }
  if (minReps >= REP_FLOOR) {
    return {
      short: `${kg(top)} × ${minReps + 1}`,
      detail: `Stay at ${kg(top)} and aim for ${minReps + 1} reps on every set.`,
      sets: last.sets.map((s) => (s.weight === top ? { ...s, reps: Math.max(s.reps, minReps + 1) } : s)),
    };
  }
  return { short: `${kg(top)} × ${REP_FLOOR}`, detail: `Hold ${kg(top)} until every set reaches ${REP_FLOOR} reps.`, sets: last.sets };
}
