import { useState, type FormEvent } from 'react';
import { FOOTBALL_TYPES, type FootballType } from '../../shared/types.ts';
import { useData, useUi } from '../data.tsx';
import { activityIntensity, DEFAULT_MINUTES, EFFORT_LABEL, FOOTBALL_LABEL } from '../lib/football.ts';
import { dateKey, parseDateKey } from '../lib/stats.ts';
import { newId } from '../lib/store.ts';
import { MUSCLE_BY_ID } from '../../shared/muscles.ts';
import { Sheet } from './Sheet.tsx';

export function FootballSheet({ onClose }: { onClose: () => void }) {
  const { settings, put } = useData();
  const { notify } = useUi();
  const today = dateKey(new Date());
  const weekday = new Date().getDay();
  const [type, setType] = useState<FootballType>(
    settings.matchDays.includes(weekday) ? 'match' : 'training',
  );
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES[type]);
  const [rpe, setRpe] = useState(7);
  const [date, setDate] = useState(today);

  function pickType(t: FootballType) {
    setType(t);
    setMinutes(DEFAULT_MINUTES[t]);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const at = date === today ? new Date() : new Date(parseDateKey(date).setHours(18));
    const activity = { id: newId(), type, performedAt: at.toISOString(), minutes, rpe, note: null };
    put('activity', activity);
    const legsHours = Math.round(MUSCLE_BY_ID.quads.recoveryHours * activityIntensity(activity));
    notify(`${FOOTBALL_LABEL[type]} logged · legs need ~${legsHours}h`);
    onClose();
  }

  return (
    <Sheet title="Log football" subtitle="Load = minutes × effort" onClose={onClose}>
      <form className="football-form" onSubmit={submit}>
        <div className="segmented wide" role="radiogroup" aria-label="Session type">
          {FOOTBALL_TYPES.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={type === t} className={type === t ? 'active' : ''} onClick={() => pickType(t)}>
              {FOOTBALL_LABEL[t]}
            </button>
          ))}
        </div>

        <label className="field">
          <span className="field-head">
            <span>Minutes</span>
            <strong>{minutes} min</strong>
          </span>
          <input type="range" min={10} max={150} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
        </label>

        <div className="field">
          <span className="field-head">
            <span>Effort</span>
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

        <div className="football-foot">
          <input type="date" className="date-input" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} aria-label="Date" />
          <span className="muted small">Load {minutes * rpe} AU</span>
        </div>
        <button className="btn pitch block">Save {FOOTBALL_LABEL[type].toLowerCase()}</button>
      </form>
    </Sheet>
  );
}
