import type { Entry, Exercise, WorkoutSet } from '../../shared/types.ts';
import { maxRepsAt, wathen1RM } from './strength.ts';

/*
 * How hard was each set? There's no effort input, so effort is inferred as
 * estimated reps in reserve (RIR; Zourdos et al., 2016): your running best
 * estimated 1RM on the exercise says how many reps the logged weight allowed,
 * and the gap to what you did is the RIR.
 *
 * - Stimulus: sets within ~4 reps of failure produce similar hypertrophy, with
 *   diminishing benefit further out (Refalo et al., 2023, Sports Med 53:649–665),
 *   so a set counts as a full "hard set" at RIR ≤ 4, half at 5, none from 6.
 * - Fatigue: training to or near failure costs disproportionately more recovery
 *   (Morán-Navarro et al., 2017, Eur J Appl Physiol 117:2387–2399).
 * - Muscle damage is greater for eccentric- and stretch-heavy exercises
 *   (Hody et al., 2019, Front Physiol 10:536) and for unaccustomed work; the
 *   repeated-bout effect protects muscles that trained the movement recently
 *   (McHugh, 2003, Scand J Med Sci Sports 13:88–97).
 */

export interface SetEffort {
  /** Estimated reps left in the tank (0 = failure). */
  rir: number;
  /** Hard-set credit, 0–1, for weekly volume. */
  hard: number;
  /** Fatigue cost in hard-set equivalents (≈1 for a set to failure). */
  fatigue: number;
}

/** Typical max reps (or max hold seconds) before you have your own history. */
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
const DEFAULT_REFERENCE = { bodyweight: 15, time: 60 };

/** Bodyweight moves lift roughly half your mass, so added kg are scaled against that. */
const BODYWEIGHT_SHARE_KG = 40;
/**
 * Your capacity is at least "best set + ~2 reps": trained lifters typically work
 * at 1–3 RIR (Helms et al., 2016, Strength Cond J 38(4):42–49). Without this,
 * steady progression would make every new best look like a set to failure.
 * Sets that go beyond what the estimate allowed (e.g. extra back-off sets at a
 * heavier weight) still come out close to failure.
 */
const TYPICAL_RIR = 2;
/** Holds have no reps: treat each 10% of max hold time left as one rep in reserve. */
const HOLD_RIR_PER_FRACTION = 10;

/** Eccentric / lengthened-position emphasis → more muscle damage per set. */
const DAMAGE: Record<string, number> = {
  'Nordic Curl': 1.5,
  'Romanian Deadlift': 1.3,
  'Good Morning': 1.3,
  Deadlift: 1.25,
  'Walking Lunge': 1.2,
  'Bulgarian Split Squat': 1.2,
  'Back Squat': 1.1,
  'Front Squat': 1.1,
  'Chest Dip': 1.1,
  'Overhead Triceps Extension': 1.1,
  'Incline Dumbbell Curl': 1.1,
};
/** No exposure to the exercise in this long → unaccustomed, no repeated-bout protection. */
const NOVELTY_DAYS = 21;
const NOVELTY_FACTOR = 1.3;
const DAY = 86_400_000;

/** Full credit up to RIR 4, half at 5, nothing from 6. */
const hardCredit = (rir: number) => Math.min(1, Math.max(0, (6 - rir) / 2));
/** 1.0 at failure, ~0.72 at RIR 2, ~0.65 at RIR 4 — scaled by hard credit beyond that. */
const fatigueCost = (rir: number) => (hardCredit(rir) * (1 + 0.6 * Math.exp(-rir / 1.5))) / 1.6;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function setEfforts(entries: Entry[], exById: Map<number, Exercise>): Map<string, SetEffort[]> {
  /** Best estimated 1RM (weighted / bodyweight-equivalent) or max hold seconds, per exercise. */
  const capacity = new Map<number, number>();
  const lastDone = new Map<number, number>();
  const out = new Map<string, SetEffort[]>();

  for (const e of [...entries].sort((a, b) => a.performedAt.localeCompare(b.performedAt))) {
    const ex = exById.get(e.exerciseId);
    if (!ex) continue;
    const at = Date.parse(e.performedAt);
    const previous = lastDone.get(ex.id);
    const novelty = previous == null || at - previous > NOVELTY_DAYS * DAY ? NOVELTY_FACTOR : 1;
    lastDone.set(ex.id, at);
    const damage = DAMAGE[ex.name] ?? 1;

    let rirs: number[];
    if (ex.metric === 'time') {
      const held = e.sets.map((s) => (s.seconds ?? 0) * (1 + s.weight / BODYWEIGHT_SHARE_KG));
      const best = Math.max(...held);
      const prior = capacity.get(ex.id) ?? REFERENCE[ex.name] ?? DEFAULT_REFERENCE.time;
      const cap = Math.max(prior, best / (1 - TYPICAL_RIR / HOLD_RIR_PER_FRACTION));
      capacity.set(ex.id, cap);
      rirs = held.map((h) => Math.max(0, (1 - h / cap) * HOLD_RIR_PER_FRACTION));
    } else {
      const load = (s: WorkoutSet) => (ex.metric === 'bodyweight' ? BODYWEIGHT_SHARE_KG + s.weight : s.weight);
      const e1rm = (s: WorkoutSet) => wathen1RM(load(s), s.reps);
      const top = e.sets.reduce((a, b) => (e1rm(b) > e1rm(a) ? b : a));
      const reference = ex.metric === 'bodyweight' ? wathen1RM(BODYWEIGHT_SHARE_KG, REFERENCE[ex.name] ?? DEFAULT_REFERENCE.bodyweight) : 0;
      const prior = capacity.get(ex.id) ?? reference;
      const cap = Math.max(prior, wathen1RM(load(top), top.reps + TYPICAL_RIR));
      capacity.set(ex.id, cap);
      rirs = e.sets.map((s) => Math.max(0, maxRepsAt(load(s), cap) - s.reps));
    }

    out.set(
      e.id,
      rirs.map((rir) => ({ rir: round1(rir), hard: hardCredit(rir), fatigue: fatigueCost(rir) * damage * novelty })),
    );
  }
  return out;
}
