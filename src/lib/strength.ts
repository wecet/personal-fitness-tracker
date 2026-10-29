/*
 * One-rep-max estimation. Wathen (1994) is among the most accurate prediction
 * equations across rep ranges for the bench press, squat and deadlift
 * (LeSuer et al., 1997, J Strength Cond Res 11(4):211–213), and unlike Epley it
 * doesn't keep inflating at high reps.
 */

const A = 48.8;
const B = 53.8;
const K = 0.075;

/** Estimated 1RM from a set of `reps` at `weight`. */
export function wathen1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return (100 * weight) / (A + B * Math.exp(-K * reps));
}

/** Inverse of Wathen: roughly how many reps are possible at `weight` for a given 1RM. */
export function maxRepsAt(weight: number, oneRM: number): number {
  if (weight <= 0 || oneRM <= 0) return Infinity;
  const x = ((100 * weight) / oneRM - A) / B;
  if (x >= 0.95) return 1; // at or above the estimated max
  if (x <= 0) return 60; // so light the equation stops meaning anything
  return Math.max(1, -Math.log(x) / K);
}
