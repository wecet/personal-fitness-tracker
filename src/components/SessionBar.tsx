import { useEffect, useState } from 'react';
import { useData, useUi } from '../data.tsx';
import { nextStep } from '../lib/routines.ts';
import { formatDuration } from '../lib/stats.ts';
import { useSession } from '../session.tsx';

const clock = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = String(totalSeconds % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

/** Seconds of rest counted in, metronome style. */
const COUNT_IN = 3;

/** Sticky bar shown while a workout is in progress: elapsed time, rest timer and Finish. */
export function SessionBar() {
  const { activeSession, entries, settings, routines, exById } = useData();
  const { openSummary, openMuscle, openSuperset } = useUi();
  const { rest, startRest, adjustRest, skipRest } = useSession();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!activeSession) return;
    const id = setInterval(() => setNow(Date.now()), rest ? 250 : 1000);
    return () => clearInterval(id);
  }, [activeSession, rest]);

  const restLeft = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;
  const counting = rest != null && restLeft > 0 && restLeft <= COUNT_IN;

  // The last three seconds tick like a metronome: a small tap on each.
  useEffect(() => {
    if (counting) navigator.vibrate?.(12);
  }, [counting, restLeft]);

  if (!activeSession) return null;
  const mine = entries.filter((e) => e.sessionId === activeSession.id);
  const sets = mine.reduce((n, e) => n + e.sets.length, 0);
  const routine = routines.find((r) => r.id === activeSession.routineId);
  const done = new Set(mine.map((e) => e.exerciseId));
  const step = routine ? nextStep(routine, done) : null;
  const nextExs = (step ?? []).map((id) => exById.get(id)).filter((ex) => ex !== undefined);
  const openNext = () => {
    if (nextExs.length > 1) openSuperset(nextExs.map((ex) => ex.id));
    else if (nextExs[0]) openMuscle(nextExs[0].muscle, nextExs[0].id);
  };
  const elapsed = Math.max(0, Math.floor((now - Date.parse(activeSession.startedAt)) / 1000));

  return (
    <div className={`session-bar ${rest ? 'resting' : ''} ${routine ? 'with-routine' : ''}`} role="region" aria-label="Workout in progress">
      {routine && (
        <button className="routine-next" onClick={openNext} disabled={nextExs.length === 0}>
          <span className="muted">{routine.name} · {routine.items.filter((i) => done.has(i.exerciseId)).length}/{routine.items.length}</span>
          <strong>{nextExs.length ? `Next: ${nextExs.map((ex) => ex.name).join(' + ')} ›` : 'All done — finish up'}</strong>
        </button>
      )}
      {rest && <span className="rest-progress" style={{ width: `${(restLeft / rest.total) * 100}%` }} />}
      {rest ? (
        <div className="rest-controls">
          <span key={counting ? restLeft : 'rest'} className={`rest-time ${counting ? 'tick' : ''}`} aria-live="polite">{clock(restLeft)}</span>
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
      {!rest && <button className="btn primary finish" onClick={() => openSummary(activeSession.id)}>Finish</button>}
    </div>
  );
}
