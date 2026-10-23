import type { Activity, Entry, WorkoutSession } from '../../shared/types.ts';
import { dateKey, parseDateKey } from './dates.ts';
import { activityLoad } from './football.ts';

const DAY = 86_400_000;
/** Sets logged outside a rated session: ~3 minutes each at a moderate effort of 7. */
const LOAD_PER_SET = 3 * 7;

export interface DayLoad {
  gym: number;
  football: number;
}

/** Session-RPE load (minutes × effort, in arbitrary units) per local day. */
export function dailyLoad(entries: Entry[], activities: Activity[], sessions: WorkoutSession[]): Map<string, DayLoad> {
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
  for (const e of entries) if (!e.sessionId || !rated.has(e.sessionId)) add(e.performedAt, 'gym', e.sets.length * LOAD_PER_SET);
  for (const a of activities) add(a.performedAt, 'football', activityLoad(a));
  return out;
}

const total = (d: DayLoad | undefined) => (d ? d.gym + d.football : 0);

function sumDays(daily: Map<string, DayLoad>, end: Date, days: number) {
  let sum = 0;
  for (let i = 0; i < days; i++) sum += total(daily.get(dateKey(new Date(end.getFullYear(), end.getMonth(), end.getDate() - i))));
  return sum;
}

export type LoadZone = 'baseline' | 'low' | 'sweet' | 'caution' | 'spike';

export interface Workload {
  acute: number;
  /** Average weekly load over the last 28 days. */
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

/** Acute:chronic workload ratio on a given day. Needs ~3 weeks of history to mean anything. */
export function workload(daily: Map<string, DayLoad>, day: Date, firstDay: string | null): Workload {
  const acute = sumDays(daily, day, 7);
  const chronic = sumDays(daily, day, 28) / 4;
  const enoughHistory = firstDay != null && day.getTime() - parseDateKey(firstDay).getTime() >= 21 * DAY;
  const ratio = chronic > 0 ? acute / chronic : null;
  const zone: LoadZone =
    !enoughHistory || ratio == null ? 'baseline' : ratio < 0.8 ? 'low' : ratio <= 1.3 ? 'sweet' : ratio <= 1.5 ? 'caution' : 'spike';
  return { acute, chronic, ratio, zone };
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
    const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() + w * 7);
    const sum: DayLoad = { gym: 0, football: 0 };
    for (let i = 0; i < 7; i++) {
      const d = daily.get(dateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
      if (d) {
        sum.gym += d.gym;
        sum.football += d.football;
      }
    }
    return { start, ...sum };
  });
}
