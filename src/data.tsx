import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api.ts';
import { beats, bestSet, muscleFatigue, personalBests, type MuscleFatigue, type PersonalBest } from './lib/stats.ts';
import type { MuscleId } from '../shared/muscles.ts';
import type { AppState, Entry, Exercise, NewEntry, NewExercise } from '../shared/types.ts';

interface AppData {
  exercises: Exercise[];
  entries: Entry[];
  exById: Map<number, Exercise>;
  pbs: Map<number, PersonalBest>;
  prEntryIds: Set<number>;
  fatigue: Map<MuscleId, MuscleFatigue>;
  now: number;
  addEntry(entry: NewEntry): Promise<{ entry: Entry; isPb: boolean }>;
  deleteEntry(id: number): Promise<void>;
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

export function DataProvider({ state, setState, children }: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState | null>>;
  children: ReactNode;
}) {
  const now = useNow();
  const { exercises, entries } = state;
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const { best: pbs, prEntryIds } = useMemo(() => personalBests(entries, exById), [entries, exById]);
  const fatigue = useMemo(() => muscleFatigue(entries, exById, now), [entries, exById, now]);

  const addEntry = useCallback(
    async (input: NewEntry) => {
      const entry = await api.addEntry(input);
      const prev = pbs.get(entry.exerciseId);
      const metric = exById.get(entry.exerciseId)?.metric ?? 'weight';
      const isPb = !!prev && beats(bestSet(entry.sets, metric), prev, metric);
      setState((s) => s && { ...s, entries: [...s.entries, entry].sort((a, b) => a.performedAt.localeCompare(b.performedAt)) });
      return { entry, isPb };
    },
    [pbs, exById, setState],
  );

  const deleteEntry = useCallback(
    async (id: number) => {
      await api.deleteEntry(id);
      setState((s) => s && { ...s, entries: s.entries.filter((e) => e.id !== id) });
    },
    [setState],
  );

  const addExercise = useCallback(
    async (input: NewExercise) => {
      const exercise = await api.addExercise(input);
      setState((s) => s && { ...s, exercises: [...s.exercises, exercise] });
      return exercise;
    },
    [setState],
  );

  const value = useMemo(
    () => ({ exercises, entries, exById, pbs, prEntryIds, fatigue, now, addEntry, deleteEntry, addExercise }),
    [exercises, entries, exById, pbs, prEntryIds, fatigue, now, addEntry, deleteEntry, addExercise],
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
