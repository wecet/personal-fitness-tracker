import type { MuscleId } from '../../shared/muscles.ts';
import type { Activity, Entry, Exercise } from '../../shared/types.ts';
import { dateKey } from './dates.ts';
import { startOfWeek } from './load.ts';
import { entryVolume, estimate1RM } from './stats.ts';

export interface YearReview {
  year: number;
  activeDays: number;
  gymDays: number;
  football: { sessions: number; matches: number; minutes: number };
  sets: number;
  /** Kilograms lifted. */
  volume: number;
  pbs: number;
  longestWeekStreak: number;
  months: { gym: number; football: number }[];
  topMuscles: [MuscleId, number][];
  favourite: { exercise: Exercise; sessions: number } | null;
  biggestLift: { exercise: Exercise; e1rm: number } | null;
  mostImproved: { exercise: Exercise; from: number; to: number } | null;
}

const inYear = (iso: string, year: number) => new Date(iso).getFullYear() === year;

export function yearsWithData(entries: Entry[], activities: Activity[]): number[] {
  const years = new Set([new Date().getFullYear()]);
  for (const r of [...entries, ...activities]) years.add(new Date(r.performedAt).getFullYear());
  return [...years].sort((a, b) => b - a);
}

export function reviewYear(year: number, entries: Entry[], activities: Activity[], exById: Map<number, Exercise>, prEntryIds: Set<string>): YearReview {
  const es = entries.filter((e) => inYear(e.performedAt, year));
  const as = activities.filter((a) => inYear(a.performedAt, year));
  const gymDays = new Set(es.map((e) => dateKey(e.performedAt)));
  const fbDays = new Set(as.map((a) => dateKey(a.performedAt)));
  const allDays = new Set([...gymDays, ...fbDays]);

  const months = Array.from({ length: 12 }, () => ({ gym: 0, football: 0 }));
  for (const d of gymDays) months[Number(d.slice(5, 7)) - 1].gym++;
  for (const d of fbDays) months[Number(d.slice(5, 7)) - 1].football++;

  const muscleSets = new Map<MuscleId, number>();
  const sessionsPerExercise = new Map<number, number>();
  const best1RM = new Map<number, { first: number; last: number; max: number }>();
  let volume = 0;
  for (const e of es) {
    const ex = exById.get(e.exerciseId);
    if (!ex) continue;
    muscleSets.set(ex.muscle, (muscleSets.get(ex.muscle) ?? 0) + e.sets.length);
    sessionsPerExercise.set(ex.id, (sessionsPerExercise.get(ex.id) ?? 0) + 1);
    volume += entryVolume(e.sets, ex.metric);
    if (ex.metric === 'weight') {
      const top = Math.max(...e.sets.map(estimate1RM));
      const b = best1RM.get(ex.id);
      best1RM.set(ex.id, b ? { first: b.first, last: top, max: Math.max(b.max, top) } : { first: top, last: top, max: top });
    }
  }

  // Longest run of consecutive weeks with at least one active day.
  const weeks = [...new Set([...allDays].map((d) => startOfWeek(new Date(`${d}T12:00`)).getTime()))].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  weeks.forEach((w, i) => {
    run = i > 0 && Math.round((w - weeks[i - 1]) / (7 * 86_400_000)) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  });

  const fav = [...sessionsPerExercise].sort((a, b) => b[1] - a[1])[0];
  const biggest = [...best1RM].sort((a, b) => b[1].max - a[1].max)[0];
  const improved = [...best1RM]
    .filter(([id, b]) => b.last > b.first && (sessionsPerExercise.get(id) ?? 0) >= 3)
    .sort((a, b) => b[1].last / b[1].first - a[1].last / a[1].first)[0];

  return {
    year,
    activeDays: allDays.size,
    gymDays: gymDays.size,
    football: { sessions: as.length, matches: as.filter((a) => a.type === 'match').length, minutes: as.reduce((m, a) => m + a.minutes, 0) },
    sets: es.reduce((n, e) => n + e.sets.length, 0),
    volume,
    pbs: es.filter((e) => prEntryIds.has(e.id)).length,
    longestWeekStreak: longest,
    months,
    topMuscles: [...muscleSets].sort((a, b) => b[1] - a[1]).slice(0, 6),
    favourite: fav ? { exercise: exById.get(fav[0])!, sessions: fav[1] } : null,
    biggestLift: biggest ? { exercise: exById.get(biggest[0])!, e1rm: biggest[1].max } : null,
    mostImproved: improved ? { exercise: exById.get(improved[0])!, from: improved[1].first, to: improved[1].last } : null,
  };
}
