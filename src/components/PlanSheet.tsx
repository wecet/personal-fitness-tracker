import { MUSCLE_BY_ID } from '../../shared/muscles.ts';
import { useData, useUi } from '../data.tsx';
import { formatPb, formatSets, recommend } from '../lib/stats.ts';
import { Icon } from './Icon.tsx';
import { Sheet } from './Sheet.tsx';

export function PlanSheet({ onClose }: { onClose: () => void }) {
  const { entries, exercises, exById, fatigue, pbs, now } = useData();
  const { openMuscle } = useUi();
  const rec = recommend(entries, exercises, exById, fatigue, new Date(now));

  return (
    <Sheet title={`${rec.weekday}’s plan`} subtitle={rec.headline} onClose={onClose}>
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
      ) : (
        <p className="muted">Everything you usually train today is still recovering. A rest or mobility day might be the move.</p>
      )}
    </Sheet>
  );
}
