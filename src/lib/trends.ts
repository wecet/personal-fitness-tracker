import type { Entry, Exercise } from '../../shared/types.ts';
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
