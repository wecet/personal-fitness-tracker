import { EXERCISE_LIBRARY } from '../../shared/exerciseLibrary.ts';
import type { Activity, Entry, Exercise, Injury, WorkoutSet } from '../../shared/types.ts';

/** Every test runs against the same fixed "now": Sunday 1 November 2026, noon local time. */
export const NOW = new Date(2026, 10, 1, 12).getTime();
export const DAY = 86_400_000;

/** The built-in library as the app sees it, with ids in library order. */
export const EXERCISES: Exercise[] = EXERCISE_LIBRARY.map(([name, muscle, secondary, metric = 'weight', kind = 'strength'], i) => ({
  id: i + 1,
  name,
  muscle,
  secondary,
  metric,
  kind,
  custom: false,
}));
export const exById = new Map(EXERCISES.map((e) => [e.id, e]));

export function exercise(name: string): Exercise {
  const ex = EXERCISES.find((e) => e.name === name);
  if (!ex) throw new Error(`No library exercise called ${name}`);
  return ex;
}

let seq = 0;

/** An entry `daysAgo` days before NOW, from [reps, kg] pairs. */
export function entry(name: string, daysAgo: number, sets: [number, number][], extra: Partial<Entry> = {}): Entry {
  return {
    id: `e${++seq}`,
    exerciseId: exercise(name).id,
    performedAt: new Date(NOW - daysAgo * DAY).toISOString(),
    sets: sets.map(([reps, weight]): WorkoutSet => ({ reps, weight })),
    note: null,
    ...extra,
  };
}

export function activity(daysAgo: number, minutes: number, rpe: number, type: Activity['type'] = 'match'): Activity {
  return { id: `a${++seq}`, type, performedAt: new Date(NOW - daysAgo * DAY).toISOString(), minutes, rpe, note: null };
}

export function injury(extra: Partial<Injury> & Pick<Injury, 'area'>): Injury {
  return { id: `i${++seq}`, side: null, startedAt: '2026-10-20', resolvedAt: null, context: 'match', note: null, ...extra };
}
