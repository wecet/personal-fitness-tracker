import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Brand } from './components/Brand.tsx';
import { Drawer, ROUTES, type Route } from './components/Drawer.tsx';
import { Icon } from './components/Icon.tsx';
import { FootballSheet } from './components/FootballSheet.tsx';
import { HistorySheet } from './components/HistorySheet.tsx';
import { MuscleSheet } from './components/MuscleSheet.tsx';
import { RoutineEditor } from './components/RoutineEditor.tsx';
import { PlanSheet } from './components/PlanSheet.tsx';
import { SessionBar } from './components/SessionBar.tsx';
import { SorenessSheet } from './components/SorenessSheet.tsx';
import { SummarySheet } from './components/SummarySheet.tsx';
import { SessionProvider } from './session.tsx';
import { DataProvider, UiCtx, type SheetState, type ToastAction } from './data.tsx';
import { dateKey } from './lib/stats.ts';
import { store, type SyncStatus } from './lib/store.ts';
import { BodyPage } from './pages/BodyPage.tsx';
import { BodyweightPage } from './pages/BodyweightPage.tsx';
import { LoadPage } from './pages/LoadPage.tsx';
import { RecordsPage } from './pages/RecordsPage.tsx';
import { RoutinesPage } from './pages/RoutinesPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { TrackerPage } from './pages/TrackerPage.tsx';
import type { AppState } from '../shared/types.ts';

const PLAN_SEEN_KEY = 'plan-seen-on';

function parseRoute(): Route {
  const r = location.hash.replace(/^#\/?/, '');
  return ROUTES.some((x) => x.id === r) ? (r as Route) : 'body';
}

function useRoute() {
  const [route, setRoute] = useState(parseRoute);
  useEffect(() => {
    const onHash = () => setRoute(parseRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

/** Show the daily plan once per day, unless a workout is already logged today. */
function shouldAutoShowPlan(state: AppState) {
  const today = dateKey(new Date());
  try {
    if (localStorage.getItem(PLAN_SEEN_KEY) === today) return false;
    localStorage.setItem(PLAN_SEEN_KEY, today);
  } catch {}
  const { entry, activity } = state.records;
  return ![...entry, ...activity].some((r) => dateKey(r.performedAt) === today);
}

function SyncBadge({ status, pending }: { status: SyncStatus; pending: number }) {
  if (status === 'synced' || (status === 'syncing' && pending === 0)) return null;
  const label =
    status === 'offline' ? `Offline${pending ? ` · ${pending} to sync` : ''}` :
    status === 'error' ? 'Sync failed — retrying' :
    `Syncing ${pending}…`;
  return (
    <button className={`sync-badge ${status}`} onClick={() => store.flush()} title="Sync now">
      <span className="dot" />
      {label}
    </button>
  );
}

type Toast = { id: number; message: string; tone: 'default' | 'pb' | 'error'; action?: ToastAction };

export function App() {
  const route = useRoute();
  const { state, status, pending } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const planChecked = useRef(false);
  useEffect(() => {
    if (!state || planChecked.current) return;
    planChecked.current = true;
    if (shouldAutoShowPlan(state)) setSheet({ type: 'plan' });
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.action ? 6000 : toast.tone === 'pb' ? 4500 : 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const ui = useMemo(
    () => ({
      openMuscle: (muscle: Parameters<typeof MuscleSheet>[0]['muscle'], exerciseId?: number) =>
        setSheet({ type: 'muscle', muscle, exerciseId }),
      openPlan: () => setSheet({ type: 'plan' }),
      openFootball: () => setSheet({ type: 'football' }),
      openSummary: (sessionId: string) => setSheet({ type: 'summary', sessionId }),
      openSoreness: () => setSheet({ type: 'soreness' }),
      openHistory: (exerciseId: number) => setSheet({ type: 'history', exerciseId }),
      openRoutine: (routineId?: string) => setSheet({ type: 'routine', routineId }),
      notify: (message: string, tone: Toast['tone'] = 'default', action?: ToastAction) => setToast({ id: Date.now(), message, tone, action }),
    }),
    [],
  );
  useEffect(() => {
    store.onRejected = (errors) => ui.notify(`Couldn’t save: ${errors[0]}`, 'error');
  }, [ui]);
  const closeSheet = useCallback(() => setSheet(null), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const title = ROUTES.find((r) => r.id === route)!.label;

  return (
    <UiCtx.Provider value={ui}>
      <header className="topbar">
        <button className="icon-btn" onClick={() => setDrawerOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
        <h1>{route === 'body' ? <Brand /> : title}</h1>
        <div className="topbar-end">
          <SyncBadge status={status} pending={pending} />
          <button className="icon-btn" onClick={ui.openPlan} aria-label="Today’s plan" disabled={!state}><Icon name="sparkle" /></button>
        </div>
      </header>
      <Drawer open={drawerOpen} route={route} onClose={closeDrawer} />

      <main className={state?.records.session.some((s) => !s.endedAt) ? 'with-session' : ''}>
        {!state ? (
          status === 'syncing' ? (
            <div className="page empty"><div className="spinner" /></div>
          ) : (
            <div className="page empty">
              <p>Couldn’t reach the server. Connect once to download your data — after that Ember works offline.</p>
              <button className="btn primary" onClick={() => store.flush()}>Retry</button>
            </div>
          )
        ) : (
          <DataProvider state={state}>
            <SessionProvider>
            {route === 'body' && <BodyPage />}
            {route === 'tracker' && <TrackerPage />}
            {route === 'routines' && <RoutinesPage />}
            {route === 'load' && <LoadPage />}
            {route === 'records' && <RecordsPage />}
            {route === 'bodyweight' && <BodyweightPage />}
            {route === 'settings' && <SettingsPage />}
            {sheet?.type === 'muscle' && (
              <MuscleSheet key={`${sheet.muscle}-${sheet.exerciseId}`} muscle={sheet.muscle} exerciseId={sheet.exerciseId} onClose={closeSheet} />
            )}
            {sheet?.type === 'plan' && <PlanSheet onClose={closeSheet} />}
            {sheet?.type === 'football' && <FootballSheet onClose={closeSheet} />}
            {sheet?.type === 'routine' && <RoutineEditor key={sheet.routineId ?? 'new'} routineId={sheet.routineId} onClose={closeSheet} />}
            {sheet?.type === 'history' && <HistorySheet key={sheet.exerciseId} exerciseId={sheet.exerciseId} onClose={closeSheet} />}
            {sheet?.type === 'soreness' && <SorenessSheet onClose={closeSheet} />}
            {sheet?.type === 'summary' && <SummarySheet sessionId={sheet.sessionId} onClose={closeSheet} />}
            <SessionBar />
            </SessionProvider>
          </DataProvider>
        )}
      </main>

      {toast && (
        <div key={toast.id} className={`toast ${toast.tone}`} role="status">
          {toast.message}
          {toast.action && (
            <button className="toast-action" onClick={() => { toast.action!.run(); setToast(null); }}>{toast.action.label}</button>
          )}
        </div>
      )}
    </UiCtx.Provider>
  );
}
