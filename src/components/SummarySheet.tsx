import { useState } from 'react';
import { MUSCLE_BY_ID } from '../../shared/muscles.ts';
import { useData, useUi } from '../data.tsx';
import { EFFORT_LABEL } from '../lib/football.ts';
import { entryVolume, formatMinutes, formatPb } from '../lib/stats.ts';
import { Sheet } from './Sheet.tsx';

export function SummarySheet({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { sessions, entries, exById, prEntryIds, pbs, put, remove, now } = useData();
  const { notify } = useUi();
  const session = sessions.find((s) => s.id === sessionId);
  const [rpe, setRpe] = useState(session?.rpe ?? 7);
  if (!session) return null;

  const finished = !!session.endedAt;
  const mine = entries.filter((e) => e.sessionId === session.id);
  const end = session.endedAt ? Date.parse(session.endedAt) : now;
  const minutes = (end - Date.parse(session.startedAt)) / 60_000;
  const sets = mine.reduce((n, e) => n + e.sets.length, 0);
  const volume = mine.reduce((kg, e) => kg + entryVolume(e.sets, exById.get(e.exerciseId)?.metric ?? 'weight'), 0);
  const prs = mine.filter((e) => prEntryIds.has(e.id));
  const muscles = [...new Set(mine.map((e) => exById.get(e.exerciseId)?.muscle).filter((m) => m !== undefined))];

  function save() {
    put('session', { ...session!, endedAt: session!.endedAt ?? new Date().toISOString(), rpe });
    notify(`Workout saved · ${formatMinutes(minutes)} · ${sets} sets`, prs.length ? 'pb' : 'default');
    onClose();
  }

  function discard() {
    remove('session', session!.id);
    onClose();
  }

  return (
    <Sheet title={finished ? 'Workout' : 'Finish workout'} subtitle={new Date(session.startedAt).toLocaleString(undefined, { weekday: 'long', hour: '2-digit', minute: '2-digit' })} onClose={onClose}>
      <div className="summary-stats">
        <div><strong>{formatMinutes(minutes)}</strong><span>duration</span></div>
        <div><strong>{sets}</strong><span>sets</span></div>
        <div><strong>{volume >= 1000 ? `${(volume / 1000).toFixed(1)} t` : `${Math.round(volume)} kg`}</strong><span>volume</span></div>
        <div><strong>{prs.length}</strong><span>PBs</span></div>
      </div>

      {prs.length > 0 && (
        <ul className="summary-prs">
          {prs.map((e) => {
            const ex = exById.get(e.exerciseId)!;
            const pb = pbs.get(ex.id);
            return <li key={e.id}>🏆 {ex.name}{pb?.entryId === e.id && <span className="pb-badge small">{formatPb(pb, ex.metric)}</span>}</li>;
          })}
        </ul>
      )}

      {muscles.length > 0 && (
        <div className="chips">
          {muscles.map((m) => <span key={m} className="chip">{MUSCLE_BY_ID[m].name}</span>)}
        </div>
      )}

      {mine.length > 0 ? (
        <>
          <div className="field">
            <span className="field-head">
              <span>How hard was that?</span>
              <strong>{EFFORT_LABEL[rpe]}</strong>
            </span>
            <div className="effort" role="radiogroup" aria-label="Effort from 1 to 10">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rpe === n} className={`effort-${n} ${rpe === n ? 'active' : ''}`} onClick={() => setRpe(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button className="btn primary block" onClick={save}>{finished ? 'Update' : 'Save workout'}</button>
        </>
      ) : (
        <>
          <p className="muted">Nothing logged in this workout yet.</p>
          <button className="btn ghost block" onClick={discard}>Discard workout</button>
        </>
      )}
      {!finished && <button className="btn ghost block" onClick={onClose}>Keep going</button>}
    </Sheet>
  );
}
