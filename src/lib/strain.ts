import type { Entry, Exercise, ExerciseMetric, WorkoutSet } from '../../shared/types.ts';

/*
 * How hard was each set? There's no effort input, so we infer it from the
 * logged numbers relative to what you can do on that exercise: a set near
 * your best is a hard set; a set well below it is a warm-up and barely counts.
 */

/** Typical "hard set" for bodyweight and timed exercises before you have history. */
const REFERENCE: Record<string, number> = {
  'Push-Up': 25,
  'Pull-Up': 10,
  'Chest Dip': 15,
  'Hanging Leg Raise': 12,
  'Ab Wheel Rollout': 12,
  'Nordic Curl': 6,
  'Russian Twist': 30,
  'Cossack Squat': 12,
  Plank: 90,
  'Side Plank': 60,
  "Farmer's Carry": 60,
};
const DEFAULT_REFERENCE: Record<Exclude<ExerciseMetric, 'weight'>, number> = { bodyweight: 15, time: 60 };

/** Added kg are scaled against roughly half a bodyweight (the share most bodyweight moves lift). */
const BODYWEIGHT_SHARE_KG = 40;
/** A first-ever weighted entry is assumed to be a solid but not all-out effort (~RPE 8). */
const FIRST_SESSION_EFFORT = 0.85;

/** A number that rises with load and reps, comparable between sets of the same exercise. */
function score(s: WorkoutSet, metric: ExerciseMetric): number {
  if (metric === 'time') return (s.seconds ?? 0) * (1 + s.weight / BODYWEIGHT_SHARE_KG);
  if (metric === 'bodyweight') return s.reps * (1 + s.weight / BODYWEIGHT_SHARE_KG);
  return s.reps <= 1 ? s.weight : s.weight * (1 + s.reps / 30); // Epley e1RM
}

/** Relative effort → strain. Below ~45% of capacity is warm-up territory; ~95%+ is a full hard set. */
const strainCurve = (relative: number) => Math.min(1, Math.max(0.03, (relative - 0.45) / 0.5));

/**
 * Strain (0–1) of every set, keyed by entry id. Capacity per exercise is the best
 * score seen so far, so effort is judged against you at the time, not today's you.
 */
export function setStrains(entries: Entry[], exById: Map<number, Exercise>): Map<string, number[]> {
  const capacity = new Map<number, number>();
  const out = new Map<string, number[]>();
  for (const e of [...entries].sort((a, b) => a.performedAt.localeCompare(b.performedAt))) {
    const ex = exById.get(e.exerciseId);
    if (!ex) continue;
    const scores = e.sets.map((s) => score(s, ex.metric));
    const top = Math.max(...scores);
    const prev =
      capacity.get(ex.id) ??
      (ex.metric === 'weight' ? top / FIRST_SESSION_EFFORT : REFERENCE[ex.name] ?? DEFAULT_REFERENCE[ex.metric]);
    const cap = Math.max(prev, top);
    capacity.set(ex.id, cap);
    out.set(e.id, scores.map((sc) => (cap > 0 ? strainCurve(sc / cap) : 0)));
  }
  return out;
}

/** Sets at or above this strain count as "hard sets" for weekly volume. */
export const HARD_SET = 0.3;
