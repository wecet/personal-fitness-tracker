import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api.ts';
import { beats, bestSet, muscleFatigue, personalBests, recommend, type MuscleFatigue, type PersonalBest, type Recommendation } from './lib/stats.ts';
import { dailyLoad, workloadSeries, type DayLoad, type Workload } from './lib/load.ts';
import { newId, store } from './lib/store.ts';
import { setEfforts, type SetEffort } from './lib/strain.ts';
import { preventionStatus, type ProtocolStatus } from './lib/injuries.ts';
import type { MuscleId } from '../shared/muscles.ts';
import { DEFAULT_SETTINGS, type Activity, type AppState, type Entry, type Exercise, type ExerciseKind, type Injury, type NewExercise, type RecordKind, type RecordMap, type Records, type Routine, type Settings, type WorkoutSession } from '../shared/types.ts';

export type NewEntry = Omit<Entry, 'id' | 'note'> & { note?: string | null };

interface AppData {
  exercises: Exercise[];
  records: Records;
  /** Sorted oldest → newest. */
  entries: Entry[];
  /** Football sessions, sorted oldest → newest. */
  activities: Activity[];
  /** Gym sessions, sorted by start. */
  sessions: WorkoutSession[];
  activeSession: WorkoutSession | null;
  routines: Routine[];
  /** Newest first. */
  injuries: Injury[];
  /** This week's injury-prevention work. */
  prevention: ProtocolStatus[];
  settings: Settings;
  rec: Recommendation;
  /** Training load per local day. */
  daily: Map<string, DayLoad>;
  firstDay: string | null;
  /** Daily acute:chronic workload from the first logged day to today. */
  loadSeries: Workload[];
  load: Workload;
  exById: Map<number, Exercise>;
  pbs: Map<number, PersonalBest>;
  prEntryIds: Set<string>;
  /** Inferred effort (reps in reserve, hard-set credit, fatigue) of every logged set, by entry id. */
  efforts: Map<string, SetEffort[]>;
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
  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...records.settings[0] }), [records.settings]);
  const sessions = useMemo(() => [...records.session].sort((a, b) => a.startedAt.localeCompare(b.startedAt)), [records.session]);
  const activeSession = sessions.findLast((s) => !s.endedAt) ?? null;
  const routines = useMemo(() => [...records.routine].sort((a, b) => a.name.localeCompare(b.name)), [records.routine]);
  const injuries = useMemo(() => [...records.injury].sort((a, b) => b.startedAt.localeCompare(a.startedAt)), [records.injury]);
  const prevention = useMemo(() => preventionStatus(entries, exById, injuries, new Date(now)), [entries, exById, injuries, now]);
  const efforts = useMemo(() => setEfforts(entries, exById), [entries, exById]);
  const fatigue = useMemo(
    () => muscleFatigue(entries, exById, now, efforts, activities, records.soreness),
    [entries, exById, now, efforts, activities, records.soreness],
  );
  const daily = useMemo(() => dailyLoad(entries, activities, sessions, efforts), [entries, activities, sessions, efforts]);
  const firstDay = useMemo(() => [...daily.keys()].sort()[0] ?? null, [daily]);
  const loadSeries = useMemo(() => workloadSeries(daily, firstDay, new Date(now)), [daily, firstDay, now]);
  const load = loadSeries[loadSeries.length - 1];
  const rec = useMemo(
    () => recommend({ entries, activities, exercises, exById, fatigue, settings, injuries, prevention, now: new Date(now) }),
    [entries, activities, exercises, exById, fatigue, settings, injuries, prevention, now],
  );

  const put = useCallback(<K extends RecordKind>(kind: K, record: RecordMap[K]) => {
    store.enqueue({ op: 'put', kind, record } as never);
  }, []);
  const remove = useCallback((kind: RecordKind, id: string) => store.enqueue({ op: 'delete', kind, id }), []);

  const addEntry = useCallback(
    (input: NewEntry) => {
      // Sets logged during a workout (not back-dated before it) belong to that session.
      const inSession = activeSession && input.performedAt >= activeSession.startedAt;
      const entry: Entry = { note: null, sessionId: inSession ? activeSession.id : null, ...input, id: newId() };
      const prev = pbs.get(entry.exerciseId);
      const metric = exById.get(entry.exerciseId)?.metric ?? 'weight';
      const isPb = !!prev && beats(bestSet(entry.sets, metric), prev, metric);
      put('entry', entry);
      return { entry, isPb };
    },
    [pbs, exById, put, activeSession],
  );

  const addExercise = useCallback(async (input: NewExercise) => {
    const exercise = await api.addExercise(input);
    store.addExercise(exercise);
    return exercise;
  }, []);

  const value = useMemo(
    () => ({ exercises, records, entries, activities, sessions, activeSession, routines, injuries, prevention, settings, rec, daily, firstDay, loadSeries, load, exById, pbs, prEntryIds, efforts, fatigue, now, put, remove, addEntry, addExercise }),
    [exercises, records, entries, activities, sessions, activeSession, routines, injuries, prevention, settings, rec, daily, firstDay, loadSeries, load, exById, pbs, prEntryIds, efforts, fatigue, now, put, remove, addEntry, addExercise],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ---------- UI actions shared across pages ----------

export interface ToastAction {
  label: string;
  run: () => void;
}

export type SheetState =
  | { type: 'muscle'; muscle: MuscleId; exerciseId?: number }
  | { type: 'plan' }
  | { type: 'quick' }
  | { type: 'football' }
  | { type: 'summary'; sessionId: string }
  | { type: 'soreness' }
  | { type: 'history'; exerciseId: number }
  | { type: 'routine'; routineId?: string }
  | { type: 'injury'; injuryId?: string }
  | { type: 'kind'; kind: Exclude<ExerciseKind, 'strength'> }
  | null;

interface UiActions {
  openMuscle(muscle: MuscleId, exerciseId?: number): void;
  openPlan(): void;
  openFootball(): void;
  openSummary(sessionId: string): void;
  openSoreness(): void;
  openHistory(exerciseId: number): void;
  openRoutine(routineId?: string): void;
  openInjury(injuryId?: string): void;
  /** All plyometric or mobility exercises, across muscles. */
  openKind(kind: Exclude<ExerciseKind, 'strength'>): void;
  openQuick(): void;
  notify(message: string, tone?: 'default' | 'pb' | 'error', action?: ToastAction): void;
}

export const UiCtx = createContext<UiActions | null>(null);

export function useUi(): UiActions {
  const value = useContext(UiCtx);
  if (!value) throw new Error('useUi must be used inside <UiCtx.Provider>');
  return value;
}
