import { dateKey } from './dates.ts';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export type BeatKind = 'gym' | 'football' | 'rest' | 'match' | 'training';

export interface WeekBeat {
  name: string;
  letter: string;
  /** 0–1, this day's training load relative to the week's biggest day. */
  level: number;
  kind: BeatKind;
  today: boolean;
  future: boolean;
}

/**
 * This week, Monday to Sunday, as seven beats. Days gone by show how much you
 * did (gym or football); days ahead show what's planned, with match day as the
 * downbeat.
 */
export function weekBeats(now: Date, daily: Map<string, { gym: number; football: number }>, matchDays: number[], trainingDays: number[]): WeekBeat[] {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const todayKey = dateKey(now);
  const days = LETTERS.map((letter, i) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const key = dateKey(date);
    const load = daily.get(key) ?? { gym: 0, football: 0 };
    return { letter, name: NAMES[i], weekday: date.getDay(), key, load, total: load.gym + load.football };
  });
  const max = Math.max(1, ...days.map((d) => d.total));
  return days.map(({ letter, name, weekday, key, load, total }) => {
    const future = key > todayKey;
    const planned: BeatKind = matchDays.includes(weekday) ? 'match' : trainingDays.includes(weekday) ? 'training' : 'rest';
    const kind: BeatKind = total > 0 ? (load.football > load.gym ? 'football' : 'gym') : future ? planned : planned === 'match' ? 'match' : 'rest';
    return { name, letter, level: total / max, kind, today: key === todayKey, future };
  });
}

