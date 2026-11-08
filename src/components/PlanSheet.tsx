import { MUSCLE_BY_ID } from '../../shared/muscles.ts';
import { useData, useUi } from '../data.tsx';
import type { ProtocolStatus } from '../lib/injuries.ts';
import { forReadiness, suggestNext } from '../lib/progression.ts';
import { formatSets } from '../lib/stats.ts';
import { CheckIn } from './CheckIn.tsx';
import { Icon } from './Icon.tsx';
import { Sheet } from './Sheet.tsx';

/** Today in one screen: how you feel, then what to do. */
export function PlanSheet({ onClose }: { onClose: () => void }) {
  const { entries, rec, exercises, sessions, now, readiness } = useData();
  const rpe = (e: { sessionId?: string | null }) => sessions.find((s) => s.id === e.sessionId)?.rpe;
  const { openMuscle, openFootball, openKind } = useUi();
  const matchDay = rec.football?.label === 'Match day';

  function logProtocol(p: ProtocolStatus['protocol']) {
    if (p.exercises === 'plyometric') return openKind('plyometric');
    const ex = exercises.find((e) => e.name === p.exercises[0]);
    if (ex) openMuscle(ex.muscle, ex.id);
  }

  const target = (exId: number) => {
    const history = entries.filter((e) => e.exerciseId === exId);
    const last = history.at(-1);
    const ex = exercises.find((e) => e.id === exId)!;
    const next = last && suggestNext(history, ex, { now, rpe });
    return { last, next: next && forReadiness(next, last, ex, readiness) };
  };

  return (
    <Sheet title={`${rec.weekday}’s plan`} subtitle={rec.headline} onClose={onClose}>
      {!matchDay && <CheckIn />}

      {rec.football ? (
        <div className="md-note">
          <span className="md-tag">{rec.football.label}</span>
          <span>{rec.football.note}</span>
        </div>
      ) : (
        <p className="muted">{rec.detail}</p>
      )}
      {rec.injured.length > 0 && (
        <p className="injury-note">
          Working around your injury: no {rec.injured.map((m) => MUSCLE_BY_ID[m].name.toLowerCase()).join(', ')}. <a href="#/injuries">Injuries →</a>
        </p>
      )}

      {rec.exercises.length > 0 ? (
        <ul className="plan-list">
          {rec.exercises.map((ex) => {
            const { last, next } = target(ex.id);
            return (
              <li key={ex.id}>
                <button onClick={() => openMuscle(ex.muscle, ex.id)}>
                  <span>
                    <strong>{ex.name}</strong>
                    <span className="muted small">
                      {next ? <span className={`next ${next.tone}`}>{next.short}</span> : last ? `Last ${formatSets(last.sets, ex.metric)}` : MUSCLE_BY_ID[ex.muscle].name}
                    </span>
                  </span>
                  <Icon name="chevron" size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : matchDay ? (
        <button className="btn pitch block" onClick={openFootball}>Log the match</button>
      ) : (
        <p className="muted">What you usually train today is still recovering — a rest or mobility day might be the move.</p>
      )}
      {rec.recovering.length > 0 && rec.exercises.length > 0 && (
        <p className="muted small">Still recovering: {rec.recovering.map((m) => MUSCLE_BY_ID[m].name).join(', ')}.</p>
      )}

      {rec.prevention.length > 0 && (
        <div className="plan-due">
          <span className="muted small">Also due</span>
          <div className="chips">
            {rec.prevention.map((s) => (
              <button key={s.protocol.id} className={`chip ${s.priority ? 'coral' : ''}`} onClick={() => logProtocol(s.protocol)}>
                {s.protocol.name} · {s.done}/{s.protocol.target}
              </button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}
