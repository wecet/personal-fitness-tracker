import type { Activity, Entry, WorkoutSession } from '../../shared/types.ts';
import { dateKey, parseDateKey } from './dates.ts';
import { activityLoad } from './football.ts';
import type { SetEffort } from './strain.ts';

/*
 * Training load is session-RPE: minutes × session effort on the CR-10 scale
 * (Foster et al., 2001, J Strength Cond Res 15:109–115), in arbitrary units (AU).
 * When a gym session wasn't rated, its effort is estimated from the sets' reps in
 * reserve (RPE ≈ 10 − RIR; Zourdos et al., 2016) at ~3 minutes per set.
 *
 * The acute:chronic workload ratio uses exponentially weighted moving averages
 * (Williams et al., 2017, Br J Sports Med 51:209–210), which respond to recent
 * load better than rolling sums. Zones follow Gabbett (2016, Br J Sports Med
 * 50:273–280): 0.8–1.3 "sweet spot", >1.5 "spike". The ratio is a rough guide —
 * its injury-prediction value is debated (Impellizzeri et al., 2020, IJSPP 15:907–913).
 *
 * Monotony (mean ÷ SD of daily load over 7 days) and strain (weekly load ×
 * monotony) are Foster's (1998, Med Sci Sports Exerc 30:1164–1168) markers;
 * monotony above ~2 means too little variation between hard and easy days.
 */

const MINUTES_PER_SET = 3;
const ACUTE_DAYS = 7;
const CHRONIC_DAYS = 28;
/** EWMA decay: λ = 2 / (N + 1). */
const LAMBDA_ACUTE = 2 / (ACUTE_DAYS + 1);
const LAMBDA_CHRONIC = 2 / (CHRONIC_DAYS + 1);
/** The chronic average needs about this long to settle before the ratio means anything. */
const BASELINE_DAYS = 28;
export const HIGH_MONOTONY = 2;

export interface DayLoad {
  gym: number;
  football: number;
}

/** Session-RPE load per local day. */
export function dailyLoad(
  entries: Entry[],
  activities: Activity[],
  sessions: WorkoutSession[],
  efforts: Map<string, SetEffort[]>,
): Map<string, DayLoad> {
  const out = new Map<string, DayLoad>();
  const add = (iso: string, key: keyof DayLoad, n: number) => {
    const k = dateKey(iso);
    const d = out.get(k) ?? { gym: 0, football: 0 };
    d[key] += n;
    out.set(k, d);
  };
  const rated = new Map(sessions.filter((s) => s.endedAt && s.rpe).map((s) => [s.id, s]));
  for (const s of rated.values()) {
    const minutes = (Date.parse(s.endedAt!) - Date.parse(s.startedAt)) / 60_000;
    add(s.startedAt, 'gym', Math.max(1, minutes) * s.rpe!);
  }
  for (const e of entries) {
    if (e.sessionId && rated.has(e.sessionId)) continue;
    const sets = efforts.get(e.id) ?? [];
    const meanRir = sets.length ? sets.reduce((sum, s) => sum + s.rir, 0) / sets.length : 3;
    const rpe = Math.min(10, Math.max(3, 10 - meanRir));
    add(e.performedAt, 'gym', e.sets.length * MINUTES_PER_SET * rpe);
  }
  for (const a of activities) add(a.performedAt, 'football', activityLoad(a));
  return out;
}

const total = (d: DayLoad | undefined) => (d ? d.gym + d.football : 0);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export type LoadZone = 'baseline' | 'low' | 'sweet' | 'caution' | 'spike';

export interface Workload {
  day: Date;
  /** EWMA daily loads expressed per week, for display. */
  acute: number;
  chronic: number;
  ratio: number | null;
  zone: LoadZone;
}

export const ZONE_LABEL: Record<LoadZone, string> = {
  baseline: 'Building baseline',
  low: 'Low — detraining',
  sweet: 'Sweet spot',
  caution: 'Caution',
  spike: 'Spike — injury risk up',
};

/** EWMA acute:chronic ratio for every day from the first logged day to `end`. */
export function workloadSeries(daily: Map<string, DayLoad>, firstDay: string | null, end: Date): Workload[] {
  if (!firstDay) return [{ day: end, acute: 0, chronic: 0, ratio: null, zone: 'baseline' }];
  const start = parseDateKey(firstDay);
  const out: Workload[] = [];
  let acute = 0;
  let chronic = 0;
  for (let d = start, i = 0; d.getTime() <= end.getTime(); d = addDays(d, 1), i++) {
    const load = total(daily.get(dateKey(d)));
    acute = LAMBDA_ACUTE * load + (1 - LAMBDA_ACUTE) * acute;
    chronic = LAMBDA_CHRONIC * load + (1 - LAMBDA_CHRONIC) * chronic;
    const ratio = chronic > 0 ? acute / chronic : null;
    const zone: LoadZone =
      i < BASELINE_DAYS || ratio == null ? 'baseline' : ratio < 0.8 ? 'low' : ratio <= 1.3 ? 'sweet' : ratio <= 1.5 ? 'caution' : 'spike';
    out.push({ day: d, acute: acute * 7, chronic: chronic * 7, ratio, zone });
  }
  return out;
}

export interface Monotony {
  weekly: number;
  /** null when every day had the same load (SD 0) or there's no load. */
  monotony: number | null;
  strain: number | null;
}

export function monotony(daily: Map<string, DayLoad>, end: Date): Monotony {
  const loads = Array.from({ length: 7 }, (_, i) => total(daily.get(dateKey(addDays(end, -i)))));
  const weekly = loads.reduce((a, b) => a + b, 0);
  const mean = weekly / 7;
  const sd = Math.sqrt(loads.reduce((s, l) => s + (l - mean) ** 2, 0) / 7);
  if (weekly === 0 || sd === 0) return { weekly, monotony: null, strain: null };
  const m = mean / sd;
  return { weekly, monotony: m, strain: weekly * m };
}

/** Monday on or before the date. */
export function startOfWeek(d: Date) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

export function weeklyLoad(daily: Map<string, DayLoad>, now: Date, weeks: number) {
  const first = startOfWeek(now);
  first.setDate(first.getDate() - (weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, w) => {
    const start = addDays(first, w * 7);
    const sum: DayLoad = { gym: 0, football: 0 };
    for (let i = 0; i < 7; i++) {
      const d = daily.get(dateKey(addDays(start, i)));
      if (d) {
        sum.gym += d.gym;
        sum.football += d.football;
      }
    }
    return { start, ...sum };
  });
}

