import type { Activity, Entry } from '../../shared/types.ts';
import { dateKey } from './dates.ts';
import { activityLoad } from './football.ts';

export interface DayLog {
  entries: Entry[];
  activities: Activity[];
  /** Gym sets plus football converted to a set-equivalent (30 AU ≈ one set), for heatmap intensity. */
  volume: number;
}

export function groupByDay(entries: Entry[], activities: Activity[]): Map<string, DayLog> {
  const map = new Map<string, DayLog>();
  const day = (iso: string) => {
    const k = dateKey(iso);
    let d = map.get(k);
    if (!d) map.set(k, (d = { entries: [], activities: [], volume: 0 }));
    return d;
  };
  for (const e of entries) {
    const d = day(e.performedAt);
    d.entries.push(e);
    d.volume += e.sets.length;
  }
  for (const a of activities) {
    const d = day(a.performedAt);
    d.activities.push(a);
    d.volume += activityLoad(a) / 30;
  }
  return map;
}

/** Intensity bucket 0–4 for heatmaps. */
export const level = (volume: number) => (volume === 0 ? 0 : volume < 9 ? 1 : volume < 16 ? 2 : volume < 23 ? 3 : 4);
