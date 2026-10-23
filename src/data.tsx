import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api.ts';
import { beats, bestSet, muscleFatigue, personalBests, recommend, type MuscleFatigue, type PersonalBest, type Recommendation } from './lib/stats.ts';
import { newId, store } from './lib/store.ts';
import type { MuscleId } from '../shared/muscles.ts';
import { DEFAULT_SETTINGS, type Activity, type AppState, type Entry, type Exercise, type NewExercise, type RecordKind, type RecordMap, type Records, type Settings } from '../shared/types.ts';

export type NewEntry = Omit<Entry, 'id' | 'note'> & { note?: string | null };

interface AppData {
  exercises: Exercise[];
  records: Records;
  /** Sorted oldest → newest. */
  entries: Entry[];
  /** Football sessions, sorted oldest → newest. */
  activities: Activity[];
  settings: Settings;
  rec: Recommendation;
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

const byPerformedAt = (a: { performedAt: string }, b: { performedAt: string }) => a.performedAt.localeCompare(b.performedAt);

export function DataProvider({ state, children }: { state: AppState; children: ReactNode }) {
  const { exercises, records } = state;
  const tick = useNow();
  // Also refresh on every change so a record logged mid-minute never looks like it's in the future.
  const now = useMemo(() => Math.max(tick, Date.now()), [tick, records]);
  const entries = useMemo(() => [...records.entry].sort(byPerformedAt), [records.entry]);
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const { best: pbs, prEntryIds } = useMemo(() => personalBests(entries, exById), [entries, exById]);
  const activities = useMemo(() => [...records.activity].sort(byPerformedAt), [records.activity]);
  const settings = records.settings[0] ?? DEFAULT_SETTINGS;
  const fatigue = useMemo(() => muscleFatigue(entries, exById, now, activities), [entries, exById, now, activities]);
  const rec = useMemo(
    () => recommend({ entries, activities, exercises, exById, fatigue, settings, now: new Date(now) }),
    [entries, activities, exercises, exById, fatigue, settings, now],
  );

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
    () => ({ exercises, records, entries, activities, settings, rec, exById, pbs, prEntryIds, fatigue, now, put, remove, addEntry, addExercise }),
    [exercises, records, entries, activities, settings, rec, exById, pbs, prEntryIds, fatigue, now, put, remove, addEntry, addExercise],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ---------- UI actions shared across pages ----------

export type SheetState = { type: 'muscle'; muscle: MuscleId; exerciseId?: number } | { type: 'plan' } | { type: 'football' } | null;

interface UiActions {
  openMuscle(muscle: MuscleId, exerciseId?: number): void;
  openPlan(): void;
  openFootball(): void;
  notify(message: string, tone?: 'default' | 'pb' | 'error'): void;
}

export const UiCtx = createContext<UiActions | null>(null);

export function useUi(): UiActions {
  const value = useContext(UiCtx);
  if (!value) throw new Error('useUi must be used inside <UiCtx.Provider>');
  return value;
}
