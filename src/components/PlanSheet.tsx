import { MUSCLE_BY_ID } from '../../shared/muscles.ts';
import { useData, useUi } from '../data.tsx';
import { suggestNext } from '../lib/progression.ts';
import { formatPb, formatSets } from '../lib/stats.ts';
import { Icon } from './Icon.tsx';
import { Sheet } from './Sheet.tsx';

export function PlanSheet({ onClose }: { onClose: () => void }) {
  const { entries, pbs, rec } = useData();
  const { openMuscle, openFootball } = useUi();

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
      {rec.recovering.length > 0 && (
        <p className="warning">
          Still recovering: {rec.recovering.map((m) => MUSCLE_BY_ID[m].name).join(', ')} — give {rec.recovering.length === 1 ? 'it' : 'them'} another day.
        </p>
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
                        {last && <span className="next"> → {suggestNext(last.sets, ex.metric)?.short}</span>}
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
