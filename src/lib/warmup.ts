import type { Exercise, WorkoutSet } from '../../shared/types.ts';

/*
 * Warm-up sets ramp up to the first working weight: lighter and longer first, then
 * heavier and shorter so the last one is close to working weight without tiring you.
 * They're a guide on screen only, never saved, so they never count towards volume,
 * PBs or fatigue.
 */

/** Below this there's little to warm up for. */
const MIN_WORKING_KG = 40;
/** Fraction of working weight × reps. The top step only for heavier work. */
const RAMP: [number, number][] = [[0.5, 8], [0.7, 5], [0.85, 2]];
const TOP_STEP_FROM_KG = 60;

const round = (kg: number) => {
  const step = kg >= 20 ? 2.5 : 1;
  return Math.round(kg / step) * step;
};

export function warmupSets(ex: Exercise, working: WorkoutSet[]): WorkoutSet[] {
  if (ex.kind !== 'strength' || ex.metric !== 'weight' || working.length === 0) return [];
  const top = working[0].weight;
  if (!(top >= MIN_WORKING_KG)) return [];
  const ramp = top >= TOP_STEP_FROM_KG ? RAMP : RAMP.slice(0, 2);
  const sets = ramp.map(([pct, reps]) => ({ reps, weight: round(top * pct) })).filter((s) => s.weight < top);
  // Two steps that round to the same weight are one step.
  return sets.filter((s, i) => i === 0 || s.weight !== sets[i - 1].weight);
}
