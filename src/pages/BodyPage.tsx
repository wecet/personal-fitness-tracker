import { MUSCLES } from '../../shared/muscles.ts';
import { BodyMap } from '../components/BodyMap.tsx';
import { Icon } from '../components/Icon.tsx';
import { useData, useUi } from '../data.tsx';
import { recommend } from '../lib/stats.ts';

export function BodyPage() {
  const { entries, exercises, exById, fatigue, now } = useData();
  const { openMuscle, openPlan } = useUi();
  const rec = recommend(entries, exercises, exById, fatigue, new Date(now));
  const recovering = MUSCLES.filter((m) => (fatigue.get(m.id)?.hoursLeft ?? 0) > 0).sort(
    (a, b) => fatigue.get(b.id)!.hoursLeft - fatigue.get(a.id)!.hoursLeft,
  );

  return (
    <div className="page body-page">
      <button className="today-card" onClick={openPlan}>
        <span className="today-icon"><Icon name="sparkle" /></span>
        <span>
          <span className="eyebrow">{rec.weekday}</span>
          <strong>{rec.headline}</strong>
        </span>
        <Icon name="chevron" />
      </button>

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
