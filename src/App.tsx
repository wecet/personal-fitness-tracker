import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.ts';
import { Drawer, ROUTES, type Route } from './components/Drawer.tsx';
import { Icon } from './components/Icon.tsx';
import { MuscleSheet } from './components/MuscleSheet.tsx';
import { PlanSheet } from './components/PlanSheet.tsx';
import { DataProvider, UiCtx, type SheetState } from './data.tsx';
import { dateKey } from './lib/stats.ts';
import { BodyPage } from './pages/BodyPage.tsx';
import { RecordsPage } from './pages/RecordsPage.tsx';
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
  return !state.entries.some((e) => dateKey(e.performedAt) === today);
}

type Toast = { id: number; message: string; tone: 'default' | 'pb' | 'error' };

export function App() {
  const route = useRoute();
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .state()
      .then((s) => {
        setState(s);
        if (shouldAutoShowPlan(s)) setSheet({ type: 'plan' });
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.tone === 'pb' ? 4500 : 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const ui = useMemo(
    () => ({
      openMuscle: (muscle: Parameters<typeof MuscleSheet>[0]['muscle'], exerciseId?: number) =>
        setSheet({ type: 'muscle', muscle, exerciseId }),
      openPlan: () => setSheet({ type: 'plan' }),
      notify: (message: string, tone: Toast['tone'] = 'default') => setToast({ id: Date.now(), message, tone }),
    }),
    [],
  );
  const closeSheet = useCallback(() => setSheet(null), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const title = ROUTES.find((r) => r.id === route)!.label;

  return (
    <UiCtx.Provider value={ui}>
      <header className="topbar">
        <button className="icon-btn" onClick={() => setDrawerOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
        <h1>{route === 'body' ? <span className="brand">Rep<span>Map</span></span> : title}</h1>
        <button className="icon-btn" onClick={ui.openPlan} aria-label="Today’s plan" disabled={!state}><Icon name="sparkle" /></button>
      </header>
      <Drawer open={drawerOpen} route={route} onClose={closeDrawer} />

      <main>
        {error ? (
          <div className="page empty">
            <p>Couldn’t reach the server: {error}</p>
            <button className="btn primary" onClick={load}>Retry</button>
          </div>
        ) : !state ? (
          <div className="page empty"><div className="spinner" /></div>
        ) : (
          <DataProvider state={state} setState={setState}>
            {route === 'body' && <BodyPage />}
            {route === 'tracker' && <TrackerPage />}
            {route === 'records' && <RecordsPage />}
            {sheet?.type === 'muscle' && (
              <MuscleSheet key={`${sheet.muscle}-${sheet.exerciseId}`} muscle={sheet.muscle} exerciseId={sheet.exerciseId} onClose={closeSheet} />
            )}
            {sheet?.type === 'plan' && <PlanSheet onClose={closeSheet} />}
          </DataProvider>
        )}
      </main>

      {toast && (
        <div key={toast.id} className={`toast ${toast.tone}`} role="status">{toast.message}</div>
      )}
    </UiCtx.Provider>
  );
}
