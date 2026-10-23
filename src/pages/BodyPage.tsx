import { MUSCLES } from '../../shared/muscles.ts';
import { BodyMap } from '../components/BodyMap.tsx';
import { Icon } from '../components/Icon.tsx';
import { useData, useUi } from '../data.tsx';

export function BodyPage() {
  const { fatigue, rec } = useData();
  const { openMuscle, openPlan, openFootball } = useUi();
  const recovering = MUSCLES.filter((m) => (fatigue.get(m.id)?.hoursLeft ?? 0) > 0).sort(
    (a, b) => fatigue.get(b.id)!.hoursLeft - fatigue.get(a.id)!.hoursLeft,
  );

  return (
    <div className="page body-page">
      <button className="today-card" onClick={openPlan}>
        <span className="today-icon"><Icon name="sparkle" /></span>
        <span>
          <span className="eyebrow">
            {rec.weekday}
            {rec.football && <span className="md-tag">{rec.football.label}</span>}
          </span>
          <strong>{rec.headline}</strong>
        </span>
        <Icon name="chevron" />
      </button>

      <div className="quick-actions">
        <button className="quick pitch" onClick={openFootball}>
          <Icon name="ball" size={18} /> Log football
        </button>
      </div>

      <BodyMap fatigue={fatigue} suggested={rec.muscles} onSelect={(m) => openMuscle(m)} />

      <div className="legend">
        <span>Just trained</span>
        <span className="legend-bar" />
        <span>Recovered</span>
      </div>

      {recovering.length > 0 && (
        <div className="chips center">
          {recovering.map((m) => (
            <button key={m.id} className="chip recovering" onClick={() => openMuscle(m.id)}>
              {m.name} · {Math.ceil(fatigue.get(m.id)!.hoursLeft)}h
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
