import { useEffect, useState } from 'react';
import { useData, useUi } from '../data.tsx';
import { formatDuration } from '../lib/stats.ts';
import { useSession } from '../session.tsx';

const clock = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = String(totalSeconds % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

/** Sticky bar shown while a workout is in progress: elapsed time, rest timer and Finish. */
export function SessionBar() {
  const { activeSession, entries, settings, routines, exById } = useData();
  const { openSummary, openMuscle } = useUi();
  const { rest, startRest, adjustRest, skipRest } = useSession();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!activeSession) return;
    const id = setInterval(() => setNow(Date.now()), rest ? 250 : 1000);
    return () => clearInterval(id);
  }, [activeSession, rest]);

  if (!activeSession) return null;
  const mine = entries.filter((e) => e.sessionId === activeSession.id);
  const sets = mine.reduce((n, e) => n + e.sets.length, 0);
  const routine = routines.find((r) => r.id === activeSession.routineId);
  const done = new Set(mine.map((e) => e.exerciseId));
  const next = routine?.items.find((i) => !done.has(i.exerciseId));
  const nextEx = next && exById.get(next.exerciseId);
  const elapsed = Math.max(0, Math.floor((now - Date.parse(activeSession.startedAt)) / 1000));
  const restLeft = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;

  return (
    <div className={`session-bar ${rest ? 'resting' : ''} ${routine ? 'with-routine' : ''}`} role="region" aria-label="Workout in progress">
      {routine && (
        <button className="routine-next" onClick={() => nextEx && openMuscle(nextEx.muscle, nextEx.id)} disabled={!nextEx}>
          <span className="muted">{routine.name} · {Math.min(done.size, routine.items.length)}/{routine.items.length}</span>
          <strong>{nextEx ? `Next: ${nextEx.name} ›` : 'All done — finish up'}</strong>
        </button>
      )}
      {rest && <span className="rest-progress" style={{ width: `${(restLeft / rest.total) * 100}%` }} />}
      {rest ? (
        <div className="rest-controls">
          <span className="rest-time" aria-live="polite">{clock(restLeft)}</span>
          <button className="pill" onClick={() => adjustRest(-15)}>−15</button>
          <button className="pill" onClick={() => adjustRest(15)}>+15</button>
          <button className="pill" onClick={skipRest}>Skip</button>
        </div>
      ) : (
        <div className="session-info">
          <span className="live-dot" />
          <strong>{clock(elapsed)}</strong>
          <span className="muted">{sets} set{sets === 1 ? '' : 's'}</span>
          <button className="pill" onClick={() => startRest()}>Rest {formatDuration(settings.restSeconds)}</button>
        </div>
      )}
      <button className="btn primary finish" onClick={() => openSummary(activeSession.id)}>Finish</button>
    </div>
  );
}
