import type { Entry, Routine, SyncOp, WorkoutSession, WorkoutSet } from '../../shared/types.ts';
import { newId } from './store.ts';

const DEFAULT_SETS: WorkoutSet[] = [{ reps: 10, weight: 0 }, { reps: 10, weight: 0 }, { reps: 10, weight: 0 }];
const MINUTES_PER_SET = 3;

/** Planned sets for a newly added exercise: whatever you did last time, else 3 × 10. */
export function plannedSets(exerciseId: number, entries: Entry[], timed: boolean): WorkoutSet[] {
  const last = entries.findLast((e) => e.exerciseId === exerciseId);
  if (last) return last.sets;
  return timed ? DEFAULT_SETS.map(() => ({ reps: 0, weight: 0, seconds: 30 })) : DEFAULT_SETS;
}

/** One-tap log: a finished session plus an entry per routine exercise, using the planned sets. */
export function quickLogOps(routine: Routine): { ops: SyncOp[]; ids: { session: string; entries: string[] } } {
  const end = new Date();
  const sets = routine.items.reduce((n, i) => n + i.sets.length, 0);
  const start = new Date(end.getTime() - sets * MINUTES_PER_SET * 60_000);
  const session: WorkoutSession = {
    id: newId(),
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
    rpe: null,
    note: null,
    routineId: routine.id,
  };
  const entries: Entry[] = routine.items.map((item) => ({
    id: newId(),
    exerciseId: item.exerciseId,
    performedAt: end.toISOString(),
    sets: item.sets,
    note: null,
    sessionId: session.id,
  }));
  return {
    ops: [{ op: 'put', kind: 'session', record: session }, ...entries.map((record) => ({ op: 'put', kind: 'entry', record }) as SyncOp)],
    ids: { session: session.id, entries: entries.map((e) => e.id) },
  };
}

/** The routine with each exercise's planned sets replaced by what was actually done in the session. */
export function refreshFromSession(routine: Routine, sessionEntries: Entry[]): Routine {
  const done = new Map(sessionEntries.map((e) => [e.exerciseId, e.sets]));
  return { ...routine, items: routine.items.map((i) => ({ ...i, sets: done.get(i.exerciseId) ?? i.sets })) };
}

/** A routine built from a finished workout, in the order exercises were done. */
export function routineFromSession(name: string, sessionEntries: Entry[]): Routine {
  const items = new Map<number, WorkoutSet[]>();
  for (const e of sessionEntries) items.set(e.exerciseId, [...(items.get(e.exerciseId) ?? []), ...e.sets]);
  return {
    id: newId(),
    name,
    items: [...items].map(([exerciseId, sets]) => ({ exerciseId, sets })),
    createdAt: new Date().toISOString(),
  };
}
