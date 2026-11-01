import type { Entry, Exercise, WorkoutSet } from '../../shared/types.ts';
import { bestSet, estimate1RM, formatDuration, formatKg } from './stats.ts';

const DAY = 86_400_000;
/** How far back "lately" reaches for trend arrows. */
export const TREND_DAYS = 56;

export type MeasureUnit = 'kg' | 'reps' | 'seconds';

/** What progress means for each kind of exercise, per session. */
export function measure(ex: Exercise, e: Entry): { y: number; label: string; unit: MeasureUnit } {
  const top = bestSet(e.sets, ex.metric);
  if (ex.metric === 'time') return { y: top.seconds ?? 0, label: 'Longest hold', unit: 'seconds' };
  if (ex.metric === 'bodyweight' && !e.sets.some((s) => s.weight > 0)) return { y: top.reps, label: 'Best set (reps)', unit: 'reps' };
  const best = Math.max(...e.sets.map(estimate1RM));
  return { y: Math.round(best * 10) / 10, label: ex.metric === 'bodyweight' ? 'Estimated 1RM (added kg)' : 'Estimated 1RM', unit: 'kg' };
}

export interface Point {
  at: number;
  y: number;
  entry: Entry;
}

/** One point per session, oldest first. Bodyweight work switches unit once you add weight, so only the latest unit is kept. */
export function progressSeries(ex: Exercise, history: Entry[]): { points: Point[]; label: string; unit: MeasureUnit } {
  const measured = history.map((entry) => ({ entry, ...measure(ex, entry) }));
  const latest = measured.at(-1);
  const same = measured.filter((m) => m.unit === latest?.unit);
  return {
    points: same.map(({ entry, y }) => ({ at: Date.parse(entry.performedAt), y, entry })),
    label: latest?.label ?? 'Best',
    unit: latest?.unit ?? 'kg',
  };
}

// ---------- the progress chart ----------

/**
 * What the progress chart can show. Weighted lifts default to the heaviest
 * weight actually lifted, with estimated 1RM as the alternative for comparing
 * across rep ranges; bodyweight work shows the best set or total reps; holds
 * show the longest hold.
 */
export type ChartView = 'top' | '1rm' | 'best' | 'total' | 'hold';

export const VIEW_LABEL: Record<ChartView, string> = {
  top: 'Top set',
  '1rm': 'Est. 1RM',
  best: 'Best set',
  total: 'Total reps',
  hold: 'Longest hold',
};

export function chartViews(ex: Exercise): ChartView[] {
  if (ex.metric === 'time') return ['hold'];
  if (ex.metric === 'bodyweight') return ['best', 'total'];
  return ['top', '1rm'];
}

export interface ViewSeries {
  points: Point[];
  unit: MeasureUnit;
  /** For bodyweight work: whether the values are added kg. */
  added: boolean;
}

/** The heaviest set of a session: top weight, and the most reps done at it. */
export function topSet(sets: WorkoutSet[]): WorkoutSet {
  const weight = Math.max(...sets.map((s) => s.weight));
  return { weight, reps: Math.max(...sets.filter((s) => s.weight === weight).map((s) => s.reps)) };
}

/** One point per session for the chosen view, oldest first. */
export function viewSeries(ex: Exercise, history: Entry[], view: ChartView): ViewSeries {
  const point = (entry: Entry, y: number): Point => ({ at: Date.parse(entry.performedAt), y, entry });
  switch (view) {
    case 'hold':
      return { points: history.map((e) => point(e, Math.max(...e.sets.map((s) => s.seconds ?? 0)))), unit: 'seconds', added: false };
    case 'total':
      return { points: history.map((e) => point(e, e.sets.reduce((n, s) => n + s.reps, 0))), unit: 'reps', added: false };
    case '1rm': {
      const { points, unit } = progressSeries(ex, history);
      return { points, unit, added: false };
    }
    default: {
      // Once bodyweight work carries added weight, chart that; earlier unloaded sessions measure something else.
      const loaded = view === 'top' || history.at(-1)?.sets.some((s) => s.weight > 0) === true;
      if (!loaded) return { points: history.map((e) => point(e, Math.max(...e.sets.map((s) => s.reps)))), unit: 'reps', added: false };
      const sessions = history.filter((e) => e.sets.some((s) => s.weight > 0));
      return { points: sessions.map((e) => point(e, topSet(e.sets).weight)), unit: 'kg', added: ex.metric === 'bodyweight' };
    }
  }
}

/** Best-so-far over time: a step each time a session beats every one before it. */
export function bestSoFar(points: Point[]): { at: number; y: number }[] {
  const out: { at: number; y: number }[] = [];
  for (const p of points) if (!out.length || p.y > out.at(-1)!.y) out.push({ at: p.at, y: p.y });
  return out;
}

export interface Trend {
  from: number;
  to: number;
  change: number;
  /** Fractional change, e.g. 0.05 = +5%. */
  pct: number;
}

/**
 * Change over the last `days`: from the last session before the window (or the
 * first one inside it) to the latest session. Needs two sessions to say anything.
 */
export function trend(points: Point[], now: number, days = TREND_DAYS): Trend | null {
  const start = now - days * DAY;
  const inside = points.filter((p) => p.at >= start);
  if (inside.length === 0) return null;
  const before = points.filter((p) => p.at < start).at(-1);
  const base = before ?? inside[0];
  const last = inside.at(-1)!;
  if (base === last || base.y <= 0) return null;
  return { from: base.y, to: last.y, change: last.y - base.y, pct: (last.y - base.y) / base.y };
}

/** "+7.5 kg", "−2 reps", "+0:10" — or "No change". */
export function formatChange(change: number, unit: MeasureUnit): string {
  const n = unit === 'kg' ? Math.round(Math.abs(change) * 2) / 2 : Math.round(Math.abs(change));
  if (n === 0) return 'No change';
  const sign = change > 0 ? '+' : '−';
  return sign + (unit === 'kg' ? formatKg(n) : unit === 'reps' ? `${n} rep${n === 1 ? '' : 's'}` : formatDuration(n));
}

/** "+4%", "−2%", "±0%". */
export const formatPct = (pct: number) => {
  const n = Math.round(pct * 100);
  return n === 0 ? '±0%' : `${n > 0 ? '+' : '−'}${Math.abs(n)}%`;
};

/** Average strength trend across exercises (e.g. a muscle region), weighting each exercise equally. */
export function averageTrend(trends: (Trend | null)[]): number | null {
  const known = trends.filter((t): t is Trend => t != null);
  return known.length ? known.reduce((s, t) => s + t.pct, 0) / known.length : null;
}

export interface RepMax {
  reps: number;
  weight: number;
  performedAt: string;
}

const REP_TARGETS = [1, 3, 5, 8, 10, 12];

/** Heaviest weight you've moved for at least N reps, for the usual rep targets you've reached. */
export function repMaxes(history: Entry[]): RepMax[] {
  const all: RepMax[] = [];
  for (const reps of REP_TARGETS) {
    let best: RepMax | null = null;
    for (const e of history) {
      for (const s of e.sets) {
        if (s.reps >= reps && s.weight > 0 && (!best || s.weight > best.weight)) best = { reps, weight: s.weight, performedAt: e.performedAt };
      }
    }
    if (best) all.push(best);
  }
  // A low-rep best no heavier than a higher-rep one says nothing new (you've never tested it).
  return all.filter((r) => !all.some((o) => o.reps > r.reps && o.weight >= r.weight));
}
