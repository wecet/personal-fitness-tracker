import { MUSCLE_BY_ID } from '../../shared/muscles.ts';
import type { Routine } from '../../shared/types.ts';
import { Icon } from '../components/Icon.tsx';
import { useData, useUi } from '../data.tsx';
import { quickLogOps } from '../lib/routines.ts';
import { store } from '../lib/store.ts';
import { useSession } from '../session.tsx';

export function RoutinesPage() {
  const { routines, exById, activeSession, remove } = useData();
  const { openRoutine, notify } = useUi();
  const { startWorkout } = useSession();

  function quickLog(r: Routine) {
    const { ops, ids } = quickLogOps(r);
    store.enqueue(...ops);
    const sets = r.items.reduce((n, i) => n + i.sets.length, 0);
    notify(`Logged ${r.name} · ${sets} sets`, 'default', {
      label: 'Undo',
      run: () => {
        ids.entries.forEach((id) => remove('entry', id));
        remove('session', ids.session);
      },
    });
  }

  function start(r: Routine) {
    startWorkout(r.id);
    location.hash = '#/';
  }

  return (
    <div className="page">
      {routines.length === 0 && (
        <p className="muted empty">Save your regular workouts as routines to start or log them in one tap. You can also save any finished workout as a routine.</p>
      )}
      {routines.map((r) => {
        const muscles = [...new Set(r.items.map((i) => exById.get(i.exerciseId)?.muscle).filter((m) => m !== undefined))];
        return (
          <section key={r.id} className="card routine-card">
            <div className="routine-head">
              <div>
                <h3>{r.name}</h3>
                <p className="muted small">
                  {r.items.length} exercise{r.items.length === 1 ? '' : 's'} · {muscles.map((m) => MUSCLE_BY_ID[m].name).join(', ')}
                </p>
              </div>
              <button className="icon-btn small" onClick={() => openRoutine(r.id)} aria-label={`Edit ${r.name}`}><Icon name="settings" size={18} /></button>
            </div>
            <ol className="routine-preview">
              {r.items.map((i) => <li key={i.exerciseId}>{exById.get(i.exerciseId)?.name}</li>)}
            </ol>
            <div className="routine-actions">
              <button className="btn primary" onClick={() => start(r)} disabled={!!activeSession}>
                <Icon name="timer" size={16} /> Start
              </button>
              <button className="btn ghost" onClick={() => quickLog(r)}>Quick log</button>
            </div>
          </section>
        );
      })}
      <button className="btn ghost block" onClick={() => openRoutine()}>
        <Icon name="plus" size={16} /> New routine
      </button>
    </div>
  );
}
