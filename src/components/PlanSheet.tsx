import { MUSCLE_BY_ID } from '../../shared/muscles.ts';
import { useData, useUi } from '../data.tsx';
import type { ProtocolStatus } from '../lib/injuries.ts';
import { suggestNext } from '../lib/progression.ts';
import { formatPb, formatSets } from '../lib/stats.ts';
import { Icon } from './Icon.tsx';
import { Sheet } from './Sheet.tsx';

export function PlanSheet({ onClose }: { onClose: () => void }) {
  const { entries, pbs, rec, exercises } = useData();
  const { openMuscle, openFootball, openSoreness, openKind } = useUi();

  function logProtocol(p: ProtocolStatus['protocol']) {
    if (p.exercises === 'plyometric') return openKind('plyometric');
    const ex = exercises.find((e) => e.name === p.exercises[0]);
    if (ex) openMuscle(ex.muscle, ex.id);
  }

  return (
    <Sheet title={`${rec.weekday}’s plan`} subtitle={rec.headline} onClose={onClose}>
      {rec.football && (
        <div className="md-note">
          <span className="md-tag">{rec.football.label}</span>
          <span>{rec.football.note}</span>
        </div>
      )}
      <p className="muted">{rec.detail}</p>

      {rec.muscles.length > 0 && (
        <div className="chips">
          {rec.muscles.map((m) => (
            <button key={m} className="chip coral" onClick={() => openMuscle(m)}>{MUSCLE_BY_ID[m].name}</button>
          ))}
        </div>
      )}
      <button className="link" onClick={openSoreness}>Feeling sore anywhere? Check in →</button>
      {rec.recovering.length > 0 && (
        <p className="warning">
          Still recovering: {rec.recovering.map((m) => MUSCLE_BY_ID[m].name).join(', ')} — give {rec.recovering.length === 1 ? 'it' : 'them'} another day.
        </p>
      )}
      {rec.injured.length > 0 && (
        <p className="injury-note">
          Working around your injury: no {rec.injured.map((m) => MUSCLE_BY_ID[m].name.toLowerCase()).join(', ')} work. <a href="#/injuries">Injuries →</a>
        </p>
      )}

      {rec.prevention.length > 0 && (
        <>
          <h3 className="section-title">Injury prevention due</h3>
          <div className="chips">
            {rec.prevention.map((s) => (
              <button key={s.protocol.id} className={`chip ${s.priority ? 'coral' : ''}`} onClick={() => logProtocol(s.protocol)}>
                {s.protocol.name} · {s.done}/{s.protocol.target}
              </button>
            ))}
          </div>
        </>
      )}

      {rec.exercises.length > 0 ? (
        <>
          <h3 className="section-title">Recommended exercises</h3>
          <ul className="plan-list">
            {rec.exercises.map((ex) => {
              const pb = pbs.get(ex.id);
              const last = entries.findLast((e) => e.exerciseId === ex.id);
              return (
                <li key={ex.id}>
                  <button onClick={() => openMuscle(ex.muscle, ex.id)}>
                    <span>
                      <strong>{ex.name}</strong>
                      <span className="muted small">
                        {MUSCLE_BY_ID[ex.muscle].name}
                        {last && ` · last ${formatSets(last.sets, ex.metric)}`}
                        {last && <span className="next"> → {suggestNext(entries.filter((e) => e.exerciseId === ex.id), ex)?.short}</span>}
                      </span>
                    </span>
                    {pb && <span className="pb-badge">PB {formatPb(pb, ex.metric)}</span>}
                    <Icon name="chevron" size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : rec.football?.label === 'Match day' ? (
        <button className="btn pitch block" onClick={openFootball}>Log the match</button>
      ) : (
        <p className="muted">Everything you usually train today is still recovering. A rest or mobility day might be the move.</p>
      )}
    </Sheet>
  );
}
