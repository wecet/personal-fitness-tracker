import { MUSCLES, MUSCLE_BY_ID, type MuscleCategory, type MuscleId } from '../../shared/muscles.ts';
import type { Entry, Exercise, ExerciseMetric, WorkoutSet } from '../../shared/types.ts';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Local-time YYYY-MM-DD. */
export function dateKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

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

// ---------- personal bests ----------

export interface PersonalBest extends WorkoutSet {
  performedAt: string;
  entryId: number;
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
  const prEntryIds = new Set<number>();
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
  /** 0 (fresh) .. 1 (just trained). Drives the red overlay. */
  level: number;
  /** Hours until the recommended rest period is over (primary work only). */
  hoursLeft: number;
}

const SECONDARY_INTENSITY = 0.5;

export function muscleFatigue(entries: Entry[], exById: Map<number, Exercise>, now: number) {
  const out = new Map<MuscleId, MuscleFatigue>();
  const hit = (muscle: MuscleId, at: number, intensity: number) => {
    const recovery = MUSCLE_BY_ID[muscle].recoveryHours * HOUR;
    const remaining = 1 - (now - at) / recovery;
    if (remaining <= 0 || at > now + HOUR) return;
    const prev = out.get(muscle) ?? { level: 0, hoursLeft: 0 };
    out.set(muscle, {
      level: Math.max(prev.level, Math.min(1, remaining * intensity)),
      hoursLeft: intensity === 1 ? Math.max(prev.hoursLeft, (remaining * recovery) / HOUR) : prev.hoursLeft,
    });
  };
  for (const e of entries) {
    const ex = exById.get(e.exerciseId);
    if (!ex) continue;
    const at = Date.parse(e.performedAt);
    if (now - at > 4 * DAY) continue;
    hit(ex.muscle, at, 1);
    for (const m of ex.secondary) hit(m, at, SECONDARY_INTENSITY);
  }
  return out;
}

export const isRecovered = (f: MuscleFatigue | undefined) => !f || (f.hoursLeft === 0 && f.level < 0.3);

export function recoveryLabel(f: MuscleFatigue | undefined): string {
  if (!f || f.level === 0) return 'Ready to train';
  if (f.hoursLeft > 0) return `Recovering · ready in ${f.hoursLeft < 1 ? '<1' : Math.round(f.hoursLeft)}h`;
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

export function weekdayHabits(entries: Entry[], exById: Map<number, Exercise>, now: Date, weeks = 12): WeekdayHabit[] {
  const since = now.getTime() - weeks * 7 * DAY;
  const days = Array.from({ length: 7 }, () => ({ dates: new Set<string>(), sets: new Map<MuscleId, number>() }));
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
  muscles: MuscleId[];
  recovering: MuscleId[];
  exercises: Exercise[];
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

export function recommend(
  entries: Entry[],
  exercises: Exercise[],
  exById: Map<number, Exercise>,
  fatigue: Map<MuscleId, MuscleFatigue>,
  now: Date,
): Recommendation {
  const weekday = WEEKDAYS[now.getDay()];
  const habit = weekdayHabits(entries, exById, now)[now.getDay()];
  const totalDays = new Set(entries.map((e) => dateKey(e.performedAt))).size;

  let headline: string;
  let detail: string;
  let targets: MuscleId[];

  if (habit.sessions >= 2 && habit.focus) {
    headline = `${weekday}s are usually ${habit.focus.toLowerCase()} days`;
    detail = `You trained on ${habit.sessions} of the last ${habit.occurrences} ${weekday}s.`;
    targets = habit.topMuscles;
  } else {
    // No pattern for today: pick the category that has been resting longest.
    const last = lastTrained(entries, exById);
    const rest = (m: MuscleId) => now.getTime() - (last.get(m) ?? 0);
    const cats: MuscleCategory[] = ['legs', 'push', 'pull'];
    const avgRest = (c: MuscleCategory) => {
      const ms = MUSCLES.filter((m) => m.category === c);
      return ms.reduce((sum, m) => sum + Math.min(rest(m.id), 30 * DAY), 0) / ms.length;
    };
    const cat = cats.sort((a, b) => avgRest(b) - avgRest(a))[0];
    targets = MUSCLES.filter((m) => m.category === cat)
      .sort((a, b) => rest(b.id) - rest(a.id))
      .slice(0, 4)
      .map((m) => m.id);
    headline = `How about a ${CATEGORY_LABEL[cat].toLowerCase()} day?`;
    detail =
      totalDays < 3
        ? 'Log a few more workouts and I’ll learn your weekly routine.'
        : `No regular pattern on ${weekday}s yet — these muscles have rested the longest.`;
  }

  const muscles = targets.filter((m) => isRecovered(fatigue.get(m)));
  const recovering = targets.filter((m) => !isRecovered(fatigue.get(m)));
  const suggested = muscles.slice(0, 4).flatMap((m) => exercisesFor(m, exercises, entries).slice(0, 2));
  return { weekday, headline, detail, muscles, recovering, exercises: suggested };
}
