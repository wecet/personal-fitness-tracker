import { MUSCLE_BY_ID } from '../../shared/muscles.ts';
import type { Entry, Exercise, WorkoutSet } from '../../shared/types.ts';
import { formatDuration, formatKg } from './stats.ts';
import { wathen1RM } from './strength.ts';

/*
 * Double progression with the "2-for-2" rule: raise the load once you can do
 * the top of the rep range on every working set in two consecutive sessions,
 * by ~2.5% for upper-body and ~5% for lower-body lifts (ACSM, 2009, "Progression
 * models in resistance training for healthy adults", Med Sci Sports Exerc
 * 41:687–708, which recommends 2–10% increases).
 *
 * Three adjustments on top:
 * - After a layoff, start lighter: strength holds for about three weeks of
 *   detraining and fades after (Bosquet et al., 2013, Scand J Med Sci Sports
 *   23:e140–e149), so come back at ~90% after 3 weeks and ~80% after 6.
 * - When three sessions in a row bring no progress, reset ~10% and build back
 *   up — the classic linear-progression reset that clears accumulated fatigue.
 * - A workout you rated easy (session effort ≤ 6/10) at the top of the rep
 *   range is enough to go up straight away, as in RPE-based autoregulation
 *   (Helms et al., 2018, Front Physiol 9:247).
 */

export interface Suggestion {
  /** Short form for lists, e.g. "77.5 kg". */
  short: string;
  /** Full sentence for the logger. */
  detail: string;
  /** Pre-filled sets for the next session. */
  sets: WorkoutSet[];
  /** Which way the load moves. */
  tone: 'up' | 'hold' | 'down';
}

export interface SuggestContext {
  now?: number;
  /** The rated effort (1–10) of the workout an entry was logged in, if any. */
  rpe?: (e: Entry) => number | null | undefined;
}

const REP_FLOOR = 6;
const REP_CEILING = 10;
const BODYWEIGHT_CEILING = 15;
const ADDED_WEIGHT_CEILING = 12;
const LOWER_BODY_JUMP = 0.05;
const UPPER_BODY_JUMP = 0.025;
const DAY = 86_400_000;
const LAYOFF_DAYS = 21;
const LONG_LAYOFF_DAYS = 42;
const STALL_SESSIONS = 3;
const RESET = 0.9;
const EASY_RPE = 6;

const isLowerBody = (ex: Exercise) => MUSCLE_BY_ID[ex.muscle].category === 'legs' || ex.muscle === 'lowerBack';

/** Percentage jump rounded to a loadable step (2.5 kg on bars/machines, 1 kg on light dumbbells). */
function nextLoad(kg: number, lower: boolean): number {
  const step = kg >= 20 ? 2.5 : 1;
  const raw = kg * (lower ? LOWER_BODY_JUMP : UPPER_BODY_JUMP);
  return kg + Math.max(step, Math.round(raw / step) * step);
}

/** Rounded to a loadable step. */
function roundLoad(kg: number): number {
  const step = kg >= 20 ? 2.5 : 1;
  return Math.max(step, Math.round(kg / step) * step);
}

/** Top working weight and the fewest reps done at it. */
function working(sets: WorkoutSet[]) {
  const top = Math.max(...sets.map((s) => s.weight));
  return { top, minReps: Math.min(...sets.filter((s) => s.weight === top).map((s) => s.reps)) };
}

/** What to aim for next time, from the exercise's logged history (oldest → newest). */
export function suggestNext(history: Entry[], ex: Exercise, ctx: SuggestContext = {}): Suggestion | null {
  const last = history.at(-1);
  if (!last || ex.kind !== 'strength') return null;
  const prev = history.at(-2);
  const now = ctx.now ?? Date.now();

  const away = Math.floor((now - Date.parse(last.performedAt)) / DAY);
  if (away > LAYOFF_DAYS) {
    const factor = away > LONG_LAYOFF_DAYS ? 0.8 : 0.9;
    const weeks = Math.round(away / 7);
    const pct = `${Math.round(factor * 100)}%`;
    if (ex.metric === 'time') {
      const sets = last.sets.map((s) => ({ ...s, seconds: Math.max(5, Math.round(((s.seconds ?? 0) * factor) / 5) * 5) }));
      return { short: pct, detail: `${weeks} weeks since you last did this — ease back in at about ${pct} of your last holds.`, sets, tone: 'down' };
    }
    const loaded = last.sets.some((s) => s.weight > 0);
    const sets = last.sets.map((s) =>
      loaded ? { ...s, weight: s.weight > 0 ? roundLoad(s.weight * factor) : 0 } : { ...s, reps: Math.max(1, Math.round(s.reps * factor)) },
    );
    const top = loaded ? formatKg(Math.max(...sets.map((s) => s.weight))) : `${Math.min(...sets.map((s) => s.reps))} reps`;
    return { short: top, detail: `${weeks} weeks since you last did this — ease back in at about ${pct}: ${top}.`, sets, tone: 'down' };
  }

  if (ex.metric === 'time') {
    const min = Math.min(...last.sets.map((s) => s.seconds ?? 0));
    const next = Math.round((min * 1.1) / 5) * 5 || min + 5;
    return {
      short: formatDuration(next),
      detail: `Your shortest hold was ${formatDuration(min)} — aim for ${formatDuration(next)} (+10%) on every set.`,
      sets: last.sets.map((s) => ({ ...s, seconds: Math.max(s.seconds ?? 0, next) })),
      tone: 'up',
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
        tone: 'up',
      };
    }
    if (minReps >= BODYWEIGHT_CEILING) {
      return { short: `${minReps} reps`, detail: `Hit ${BODYWEIGHT_CEILING}+ on every set once more and it's time to add weight.`, sets: last.sets, tone: 'hold' };
    }
    return {
      short: `${minReps + 1} reps`,
      detail: `Aim for ${minReps + 1}+ reps on every set.`,
      sets: last.sets.map((s) => ({ ...s, reps: Math.max(s.reps, minReps + 1) })),
      tone: 'up',
    };
  }

  const ceiling = ex.metric === 'bodyweight' ? ADDED_WEIGHT_CEILING : REP_CEILING;
  const prefix = ex.metric === 'bodyweight' ? '+' : '';
  const kg = (n: number) => `${prefix}${formatKg(n)}`;
  const { top, minReps } = working(last.sets);
  const prevWork = prev && working(prev.sets);
  const hitTop = minReps >= ceiling;
  const twoInARow = hitTop && prevWork && prevWork.top === top && prevWork.minReps >= ceiling;
  const effort = ctx.rpe?.(last);
  const easy = hitTop && effort != null && effort <= EASY_RPE;
  const goUp = (why: string) => {
    const next = nextLoad(top, isLowerBody(ex));
    return {
      short: kg(next),
      detail: `${why} — go up to ${kg(next)}.`,
      sets: last.sets.map((s) => ({ ...s, weight: s.weight === top ? next : s.weight, reps: Math.max(REP_FLOOR, s.reps - 2) })),
      tone: 'up' as const,
    };
  };

  if (twoInARow) return goUp(`${ceiling}+ reps on every set at ${kg(top)} two sessions running`);
  if (easy) return goUp(`${ceiling}+ reps on every set at ${kg(top)} and the workout felt easy (${effort}/10)`);
  if (hitTop) {
    return {
      short: `${kg(top)} × ${ceiling}`,
      detail: `${ceiling}+ reps on every set at ${kg(top)} — do it once more, then add weight.`,
      sets: last.sets,
      tone: 'hold',
    };
  }

  // Stalled: several sessions at this weight and none beat the first of them.
  const recent = history.slice(-STALL_SESSIONS);
  const e1rm = (e: Entry) => Math.max(...e.sets.map((s) => wathen1RM(s.weight, s.reps)));
  const stalled =
    recent.length === STALL_SESSIONS && top > 0 &&
    recent.every((e) => working(e.sets).top === top) &&
    recent.slice(1).every((e) => e1rm(e) <= e1rm(recent[0]));
  if (stalled) {
    const reset = roundLoad(top * RESET);
    return {
      short: kg(reset),
      detail: `No progress at ${kg(top)} in ${STALL_SESSIONS} sessions — drop to ${kg(reset)} and build back up.`,
      sets: last.sets.map((s) => ({ ...s, weight: s.weight === top ? reset : s.weight })),
      tone: 'down',
    };
  }
  if (minReps >= REP_FLOOR) {
    return {
      short: `${kg(top)} × ${minReps + 1}`,
      detail: `Stay at ${kg(top)} and aim for ${minReps + 1} reps on every set.`,
      sets: last.sets.map((s) => (s.weight === top ? { ...s, reps: Math.max(s.reps, minReps + 1) } : s)),
      tone: 'up',
    };
  }
  return { short: `${kg(top)} × ${REP_FLOOR}`, detail: `Hold ${kg(top)} until every set reaches ${REP_FLOOR} reps.`, sets: last.sets, tone: 'hold' };
}
