import { MUSCLES, MUSCLE_BY_ID, type MuscleCategory, type MuscleId } from '../../shared/muscles.ts';
import type { Activity, Entry, Exercise, ExerciseMetric, Settings, Soreness, SorenessLevel, WorkoutSet } from '../../shared/types.ts';
import { dateKey } from './dates.ts';
import { activityLoad, FOOTBALL_MUSCLES, footballContext } from './football.ts';
import type { SetEffort } from './strain.ts';
import { wathen1RM } from './strength.ts';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export { dateKey, parseDateKey } from './dates.ts';

// ---------- formatting ----------

export const formatKg = (kg: number) => `${Number.isInteger(kg) ? kg : kg.toFixed(2).replace(/0$/, '')} kg`;

function range(values: number[], fmt: (n: number) => string = String) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`;
}

/** 45 → "45s", 90 → "1:30" */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const trimKg = (n: number) => String(Number.isInteger(n) ? n : Number(n.toFixed(2)));

/** One set, e.g. "10 × 25 kg", "12 reps", "8 × +10 kg", "1:30". */
export function formatSet(s: WorkoutSet, metric: ExerciseMetric): string {
  if (metric === 'time') return s.weight > 0 ? `${formatDuration(s.seconds ?? 0)} @ ${formatKg(s.weight)}` : formatDuration(s.seconds ?? 0);
  if (metric === 'bodyweight') return s.weight > 0 ? `${s.reps} × +${formatKg(s.weight)}` : `${s.reps} reps`;
  return s.weight > 0 ? `${s.reps} × ${formatKg(s.weight)}` : `${s.reps} reps`;
}

/** A whole entry, e.g. "3 × 8–10 @ 25 kg", "3 × 12 reps", "3 × 0:45–1:00". */
export function formatSets(sets: WorkoutSet[], metric: ExerciseMetric): string {
  const weights = sets.map((s) => s.weight);
  const loaded = weights.some((w) => w > 0);
  const weight = range(weights, trimKg);
  if (metric === 'time') {
    const time = range(sets.map((s) => s.seconds ?? 0), formatDuration);
    return `${sets.length} × ${time}${loaded ? ` @ ${weight} kg` : ''}`;
  }
  const reps = range(sets.map((s) => s.reps));
  if (!loaded) return `${sets.length} × ${reps} reps`;
  return `${sets.length} × ${reps} @ ${metric === 'bodyweight' ? '+' : ''}${weight} kg`;
}

export const formatPb = (pb: PersonalBest, metric: ExerciseMetric) => formatSet(pb, metric);

/** Estimated one-rep max (Wathen; see strength.ts). */
export const estimate1RM = (s: WorkoutSet) => wathen1RM(s.weight, s.reps);

/** Kilograms moved (reps × weight). Timed holds don't count. */
export function entryVolume(sets: WorkoutSet[], metric: ExerciseMetric): number {
  return metric === 'time' ? 0 : sets.reduce((sum, s) => sum + s.reps * s.weight, 0);
}

/** "52 min", "1 h 05" */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

// ---------- personal bests ----------

export interface PersonalBest extends WorkoutSet {
  performedAt: string;
  entryId: string;
}

/** Heavier wins; at equal weight, more reps (or a longer hold for timed exercises). */
export function beats(a: WorkoutSet, b: WorkoutSet, metric: ExerciseMetric): boolean {
  if (a.weight !== b.weight) return a.weight > b.weight;
  return metric === 'time' ? (a.seconds ?? 0) > (b.seconds ?? 0) : a.reps > b.reps;
}

export function bestSet(sets: WorkoutSet[], metric: ExerciseMetric): WorkoutSet {
  return sets.reduce((best, s) => (beats(s, best, metric) ? s : best));
}

/** Current PB per exercise, plus the ids of every entry that set a new PB when it was logged. */
export function personalBests(entries: Entry[], exById: Map<number, Exercise>) {
  const best = new Map<number, PersonalBest>();
  const prEntryIds = new Set<string>();
  for (const e of [...entries].sort((a, b) => a.performedAt.localeCompare(b.performedAt))) {
    const metric = exById.get(e.exerciseId)?.metric ?? 'weight';
    const top = bestSet(e.sets, metric);
    const current = best.get(e.exerciseId);
    if (!current || beats(top, current, metric)) {
      best.set(e.exerciseId, { ...top, performedAt: e.performedAt, entryId: e.id });
      prEntryIds.add(e.id);
    }
  }
  return { best, prEntryIds };
}

// ---------- recovery ----------

export interface MuscleFatigue {
  /** 0 (fresh) .. 1 (wrecked). Drives the red overlay. */
  level: number;
  /** Hours until the level drops below the "ready" threshold. */
  hoursLeft: number;
  /** Set when a soreness check-in is part of what keeps this muscle recovering. */
  sore?: SorenessLevel;
}

/*
 * Fatigue follows the fitness–fatigue (impulse–response) tradition (Banister et
 * al., 1975): each session adds fatigue that decays exponentially, here with a
 * per-muscle time constant τ (muscles.ts). Load is in hard-set equivalents (the
 * sum of SetEffort.fatigue; assisting muscles take half). The visible level
 * saturates, level = 1 − e^(−load/3), because performance can only drop so far.
 *
 * Calibration: a typical session of ~4 sets at ~2 RIR (load ≈ 2.9) drops below
 * the "ready" level after ≈ τ hours; bigger or closer-to-failure sessions take
 * longer (logarithmically), lighter ones less.
 */
const LOAD_SCALE = 3;
const READY_BELOW = 0.3;
/** Load at which a muscle counts as ready again. */
const READY_LOAD = -LOAD_SCALE * Math.log(1 - READY_BELOW);
const SECONDARY_SHARE = 0.5;
const levelOf = (load: number) => 1 - Math.exp(-load / LOAD_SCALE);

/**
 * A hard 90-minute match (90 min × effort 8 = 720 AU) leaves the legs needing ~72h,
 * in line with post-match recovery of sprint, jump and muscle-damage markers
 * (Nédélec et al., 2012, Sports Med 42:997–1015). Scaled by session load.
 */
const MATCH_LOAD = 2.9;
const MATCH_AU = 720;
/** Reported soreness keeps a muscle out of hard work ~24h (a bit) or ~48h (very). */
const SORENESS: Record<SorenessLevel, { load: number; tau: number }> = {
  1: { load: READY_LOAD * Math.E, tau: 24 },
  2: { load: READY_LOAD * Math.E ** 2, tau: 24 },
};

interface Hit {
  at: number;
  load: number;
  /** Decay time constant, hours. */
  tau: number;
  sore?: SorenessLevel;
}

const remainingLoad = (hits: Hit[], t: number) =>
  hits.reduce((sum, h) => {
    const elapsed = (t - h.at) / HOUR;
    return elapsed < 0 ? sum : sum + h.load * Math.exp(-elapsed / h.tau);
  }, 0);

/** Hours for a fresh load on a muscle to decay back to "ready". */
export function hoursToRecover(muscle: MuscleId, load: number): number {
  return load <= READY_LOAD ? 0 : Math.round(MUSCLE_BY_ID[muscle].recoveryHours * Math.log(load / READY_LOAD));
}

/** Leg load a football session leaves, by muscle share. */
export const footballLoad = (a: Activity, share: number) => MATCH_LOAD * Math.min(1.7, activityLoad(a) / MATCH_AU) * share;

export function muscleFatigue(
  entries: Entry[],
  exById: Map<number, Exercise>,
  now: number,
  efforts: Map<string, SetEffort[]>,
  activities: Activity[] = [],
  soreness: Soreness[] = [],
) {
  const hits = new Map<MuscleId, Hit[]>();
  const add = (m: MuscleId, at: number, load: number, tau = MUSCLE_BY_ID[m].recoveryHours, sore?: SorenessLevel) => {
    if (load <= 0 || at > now + HOUR || load * Math.exp(-(now - at) / HOUR / tau) < 0.02) return;
    hits.set(m, [...(hits.get(m) ?? []), { at, load, tau, sore }]);
  };

  for (const e of entries) {
    const ex = exById.get(e.exerciseId);
    const at = Date.parse(e.performedAt);
    if (!ex || now - at > 10 * DAY) continue;
    const load = (efforts.get(e.id) ?? []).reduce((sum, s) => sum + s.fatigue, 0);
    add(ex.muscle, at, load);
    for (const m of ex.secondary) add(m, at, load * SECONDARY_SHARE);
  }
  for (const a of activities) {
    const at = Date.parse(a.performedAt);
    if (now - at > 10 * DAY) continue;
    for (const [m, share] of FOOTBALL_MUSCLES) add(m, at, footballLoad(a, share));
  }
  // Only the most recent check-in counts: reporting a muscle as fine again clears it.
  const latest = soreness.reduce<Soreness | null>((a, b) => (!a || b.recordedAt > a.recordedAt ? b : a), null);
  if (latest) {
    for (const [m, level] of Object.entries(latest.muscles) as [MuscleId, SorenessLevel][]) {
      add(m, Date.parse(latest.recordedAt), SORENESS[level].load, SORENESS[level].tau, level);
    }
  }

  const out = new Map<MuscleId, MuscleFatigue>();
  for (const [m, list] of hits) {
    const level = levelOf(remainingLoad(list, now));
    let hoursLeft = 0;
    while (hoursLeft < 168 && levelOf(remainingLoad(list, now + hoursLeft * HOUR)) >= READY_BELOW) hoursLeft++;
    const sore = list.find((h) => h.sore)?.sore;
    out.set(m, { level, hoursLeft, sore: hoursLeft > 0 ? sore : undefined });
  }
  return out;
}

/**
 * Hard sets per muscle in the last 7 days. Sets within ~4 reps of failure count
 * fully; assisting muscles count half, the "fractional" method that best fits
 * hypertrophy data (Pelland et al., 2024, SportRxiv).
 */
export function weeklySets(entries: Entry[], exById: Map<number, Exercise>, now: number, efforts: Map<string, SetEffort[]>): Map<MuscleId, number> {
  const out = new Map<MuscleId, number>();
  const add = (m: MuscleId, n: number) => out.set(m, (out.get(m) ?? 0) + n);
  for (const e of entries) {
    const ex = exById.get(e.exerciseId);
    const age = now - Date.parse(e.performedAt);
    if (!ex || age < 0 || age > 7 * DAY) continue;
    const hard = (efforts.get(e.id) ?? []).reduce((sum, s) => sum + s.hard, 0);
    add(ex.muscle, hard);
    for (const m of ex.secondary) add(m, hard * SECONDARY_SHARE);
  }
  return out;
}

/** Whole days since each muscle last got direct (primary) gym work; missing = never. */
export function daysSinceTrained(entries: Entry[], exById: Map<number, Exercise>, now: number): Map<MuscleId, number> {
  const out = new Map<MuscleId, number>();
  for (const [m, at] of lastTrained(entries, exById)) out.set(m, Math.floor((now - at) / DAY));
  return out;
}

export const isRecovered = (f: MuscleFatigue | undefined) => !f || f.hoursLeft === 0;

export function recoveryLabel(f: MuscleFatigue | undefined): string {
  if (!f || f.level === 0) return 'Ready to train';
  if (f.sore) return `${f.sore === 2 ? 'Very sore' : 'A bit sore'} · rest ~${Math.ceil(f.hoursLeft)}h`;
  if (f.hoursLeft > 0) return `Recovering · ready in ~${f.hoursLeft}h`;
  return 'Lightly worked · good to go';
}

// ---------- habits ----------

const CATEGORY_LABEL: Record<MuscleCategory, string> = { push: 'Push', pull: 'Pull', legs: 'Lower body', core: 'Core' };

export interface WeekdayHabit {
  weekday: number;
  /** Distinct days trained on this weekday within the window. */
  sessions: number;
  /** How many of this weekday fell inside the window. */
  occurrences: number;
  focus: string | null;
  topMuscles: MuscleId[];
  /** Football sessions on this weekday within the window. */
  football: number;
}

function focusLabel(sets: Map<MuscleId, number>): string | null {
  const byCat: Record<MuscleCategory, number> = { push: 0, pull: 0, legs: 0, core: 0 };
  let total = 0;
  for (const [m, n] of sets) {
    byCat[MUSCLE_BY_ID[m].category] += n;
    total += n;
  }
  if (total === 0) return null;
  const share = (c: MuscleCategory) => byCat[c] / total;
  for (const c of ['legs', 'push', 'pull', 'core'] as const) if (share(c) >= 0.6) return CATEGORY_LABEL[c];
  if (share('push') + share('pull') >= 0.7) return 'Upper body';
  return 'Full body';
}

export function weekdayHabits(
  entries: Entry[],
  exById: Map<number, Exercise>,
  now: Date,
  activities: Activity[] = [],
  weeks = 12,
): WeekdayHabit[] {
  const since = now.getTime() - weeks * 7 * DAY;
  const days = Array.from({ length: 7 }, () => ({ dates: new Set<string>(), sets: new Map<MuscleId, number>(), football: new Set<string>() }));
  for (const a of activities) {
    const at = new Date(a.performedAt);
    if (at.getTime() >= since && at.getTime() <= now.getTime()) days[at.getDay()].football.add(dateKey(at));
  }
  for (const e of entries) {
    const at = new Date(e.performedAt);
    const ex = exById.get(e.exerciseId);
    if (!ex || at.getTime() < since || at.getTime() > now.getTime()) continue;
    const day = days[at.getDay()];
    day.dates.add(dateKey(at));
    day.sets.set(ex.muscle, (day.sets.get(ex.muscle) ?? 0) + e.sets.length);
  }
  return days.map((d, weekday) => {
    const total = [...d.sets.values()].reduce((a, b) => a + b, 0);
    return {
      weekday,
      sessions: d.dates.size,
      football: d.football.size,
      occurrences: weeks,
      focus: focusLabel(d.sets),
      topMuscles: [...d.sets]
        .filter(([, n]) => n / total >= 0.1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([m]) => m),
    };
  });
}

// ---------- recommendations ----------

export interface Recommendation {
  weekday: string;
  headline: string;
  detail: string;
  /** Match-day guidance, when a football schedule applies today. */
  football: { label: string; note: string } | null;
  muscles: MuscleId[];
  recovering: MuscleId[];
  exercises: Exercise[];
}

export interface RecommendInput {
  entries: Entry[];
  activities: Activity[];
  exercises: Exercise[];
  exById: Map<number, Exercise>;
  fatigue: Map<MuscleId, MuscleFatigue>;
  settings: Settings;
  now: Date;
}

function lastTrained(entries: Entry[], exById: Map<number, Exercise>) {
  const last = new Map<MuscleId, number>();
  for (const e of entries) {
    const m = exById.get(e.exerciseId)?.muscle;
    if (m) last.set(m, Math.max(last.get(m) ?? 0, Date.parse(e.performedAt)));
  }
  return last;
}

/** Most-used exercises for a muscle first, falling back to library order. */
export function exercisesFor(muscle: MuscleId, exercises: Exercise[], entries: Entry[]) {
  const uses = new Map<number, number>();
  for (const e of entries) uses.set(e.exerciseId, (uses.get(e.exerciseId) ?? 0) + 1);
  return exercises
    .filter((ex) => ex.muscle === muscle)
    .sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0) || a.id - b.id);
}

/** The category that has gone longest without training, among those allowed. */
function mostRested(entries: Entry[], exById: Map<number, Exercise>, now: Date, cats: MuscleCategory[]) {
  const last = lastTrained(entries, exById);
  const rest = (m: MuscleId) => now.getTime() - (last.get(m) ?? 0);
  const avgRest = (c: MuscleCategory) => {
    const ms = MUSCLES.filter((m) => m.category === c);
    return ms.reduce((sum, m) => sum + Math.min(rest(m.id), 30 * DAY), 0) / ms.length;
  };
  const cat = [...cats].sort((a, b) => avgRest(b) - avgRest(a))[0];
  const muscles = MUSCLES.filter((m) => m.category === cat)
    .sort((a, b) => rest(b.id) - rest(a.id))
    .slice(0, 4)
    .map((m) => m.id);
  return { cat, muscles };
}

export function recommend({ entries, activities, exercises, exById, fatigue, settings, now }: RecommendInput): Recommendation {
  const weekday = WEEKDAYS[now.getDay()];
  const habit = weekdayHabits(entries, exById, now, activities)[now.getDay()];
  const totalDays = new Set(entries.map((e) => dateKey(e.performedAt))).size;
  const ctx = footballContext(now, settings, activities);
  const football = ctx.label && ctx.note ? { label: ctx.label, note: ctx.note } : null;
  const isLegs = (m: MuscleId) => MUSCLE_BY_ID[m].category === 'legs';

  if (ctx.restDay) {
    return { weekday, headline: 'Match day ⚽', detail: 'No lifting today — good luck out there.', football, muscles: [], recovering: [], exercises: [] };
  }

  let headline: string;
  let detail: string;
  let targets: MuscleId[];

  if (habit.sessions >= 2 && habit.focus) {
    headline = `${weekday}s are usually ${habit.focus.toLowerCase()} days`;
    detail = `You trained on ${habit.sessions} of the last ${habit.occurrences} ${weekday}s.`;
    targets = habit.topMuscles;
  } else {
    // No pattern for today: pick the category that has been resting longest.
    const cats: MuscleCategory[] = ctx.avoidLegs ? ['push', 'pull'] : ctx.legsWindow ? ['legs'] : ['legs', 'push', 'pull'];
    const pick = mostRested(entries, exById, now, cats);
    targets = pick.muscles;
    headline = `How about a ${CATEGORY_LABEL[pick.cat].toLowerCase()} day?`;
    detail =
      totalDays < 3
        ? 'Log a few more workouts and I’ll learn your weekly routine.'
        : `No regular pattern on ${weekday}s yet — these muscles have rested the longest.`;
  }

  if (ctx.avoidLegs && targets.some(isLegs)) {
    targets = targets.filter((m) => !isLegs(m));
    if (targets.length === 0) {
      const pick = mostRested(entries, exById, now, ['push', 'pull']);
      targets = pick.muscles;
      headline = `Swap legs for ${CATEGORY_LABEL[pick.cat].toLowerCase()} today`;
    }
  }

  const muscles = targets.filter((m) => isRecovered(fatigue.get(m)));
  const recovering = targets.filter((m) => !isRecovered(fatigue.get(m)));
  const suggested = muscles.slice(0, 4).flatMap((m) => exercisesFor(m, exercises, entries).slice(0, 2));
  return { weekday, headline, detail, football, muscles, recovering, exercises: suggested };
}
