import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api.ts';
import { beats, bestSet, muscleFatigue, personalBests, type MuscleFatigue, type PersonalBest } from './lib/stats.ts';
import { newId, store } from './lib/store.ts';
import type { MuscleId } from '../shared/muscles.ts';
import type { AppState, Entry, Exercise, NewExercise, RecordKind, RecordMap, Records } from '../shared/types.ts';

export type NewEntry = Omit<Entry, 'id' | 'note'> & { note?: string | null };

interface AppData {
  exercises: Exercise[];
  records: Records;
  /** Sorted oldest → newest. */
  entries: Entry[];
  exById: Map<number, Exercise>;
  pbs: Map<number, PersonalBest>;
  prEntryIds: Set<string>;
  fatigue: Map<MuscleId, MuscleFatigue>;
  now: number;
  put<K extends RecordKind>(kind: K, record: RecordMap[K]): void;
  remove(kind: RecordKind, id: string): void;
  addEntry(entry: NewEntry): { entry: Entry; isPb: boolean };
  addExercise(exercise: NewExercise): Promise<Exercise>;
}

const Ctx = createContext<AppData | null>(null);

export function useData(): AppData {
  const value = useContext(Ctx);
  if (!value) throw new Error('useData must be used inside <DataProvider>');
  return value;
}

/** Re-renders every minute so the recovery overlay keeps fading. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs]);
  return now;
}

const byPerformedAt = (a: Entry, b: Entry) => a.performedAt.localeCompare(b.performedAt);

export function DataProvider({ state, children }: { state: AppState; children: ReactNode }) {
  const now = useNow();
  const { exercises, records } = state;
  const entries = useMemo(() => [...records.entry].sort(byPerformedAt), [records.entry]);
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const { best: pbs, prEntryIds } = useMemo(() => personalBests(entries, exById), [entries, exById]);
  const fatigue = useMemo(() => muscleFatigue(entries, exById, now), [entries, exById, now]);

  const put = useCallback(<K extends RecordKind>(kind: K, record: RecordMap[K]) => {
    store.enqueue({ op: 'put', kind, record } as never);
  }, []);
  const remove = useCallback((kind: RecordKind, id: string) => store.enqueue({ op: 'delete', kind, id }), []);

  const addEntry = useCallback(
    (input: NewEntry) => {
      const entry: Entry = { note: null, ...input, id: newId() };
      const prev = pbs.get(entry.exerciseId);
      const metric = exById.get(entry.exerciseId)?.metric ?? 'weight';
      const isPb = !!prev && beats(bestSet(entry.sets, metric), prev, metric);
      put('entry', entry);
      return { entry, isPb };
    },
    [pbs, exById, put],
  );

  const addExercise = useCallback(async (input: NewExercise) => {
    const exercise = await api.addExercise(input);
    store.addExercise(exercise);
    return exercise;
  }, []);

  const value = useMemo(
    () => ({ exercises, records, entries, exById, pbs, prEntryIds, fatigue, now, put, remove, addEntry, addExercise }),
    [exercises, records, entries, exById, pbs, prEntryIds, fatigue, now, put, remove, addEntry, addExercise],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ---------- UI actions shared across pages ----------

export type SheetState = { type: 'muscle'; muscle: MuscleId; exerciseId?: number } | { type: 'plan' } | null;

interface UiActions {
  openMuscle(muscle: MuscleId, exerciseId?: number): void;
  openPlan(): void;
  notify(message: string, tone?: 'default' | 'pb' | 'error'): void;
}

export const UiCtx = createContext<UiActions | null>(null);

export function useUi(): UiActions {
  const value = useContext(UiCtx);
  if (!value) throw new Error('useUi must be used inside <UiCtx.Provider>');
  return value;
}
