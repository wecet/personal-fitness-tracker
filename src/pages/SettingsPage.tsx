import { useState } from 'react';
import { Icon } from '../components/Icon.tsx';
import { PlateSheet } from '../components/PlateSheet.tsx';
import { useData } from '../data.tsx';
import { formatDuration, WEEKDAYS } from '../lib/stats.ts';
import type { Settings } from '../../shared/types.ts';

const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

function DayPicker({ label, hint, value, onChange }: {
  label: string;
  hint: string;
  value: number[];
  onChange: (days: number[]) => void;
}) {
  const toggle = (d: number) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);
  return (
    <div className="field">
      <span className="field-head"><span>{label}</span></span>
      <div className="day-picker" role="group" aria-label={label}>
        {MON_FIRST.map((d) => (
          <button key={d} type="button" aria-pressed={value.includes(d)} className={value.includes(d) ? 'active' : ''} onClick={() => toggle(d)}>
            {WEEKDAYS[d].slice(0, 3)}
          </button>
        ))}
      </div>
      <p className="muted small">{hint}</p>
    </div>
  );
}

export function SettingsPage() {
  const { settings, put } = useData();
  const update = (patch: Partial<Settings>) => put('settings', { ...settings, ...patch });
  const [plates, setPlates] = useState(false);

  return (
    <div className="page">
      <section className="card">
        <h3>Football schedule</h3>
        <p className="muted small">Ember plans your gym days around these — no heavy legs the day before or after a match, or on training days.</p>
        <DayPicker label="Match days" hint="Usually one day a week." value={settings.matchDays} onChange={(matchDays) => update({ matchDays })} />
        <DayPicker label="Training days" hint="Include days you only sometimes train." value={settings.trainingDays} onChange={(trainingDays) => update({ trainingDays })} />
      </section>
      <section className="card">
        <h3>Rest timer</h3>
        <p className="muted small">Default rest between sets during a workout. You can nudge it ±15s while it runs.</p>
        <div className="day-picker" role="radiogroup" aria-label="Rest duration">
          {[45, 60, 90, 120, 150, 180, 240].map((s) => (
            <button key={s} type="button" role="radio" aria-checked={settings.restSeconds === s}
              className={settings.restSeconds === s ? 'active' : ''} onClick={() => update({ restSeconds: s })}>
              {formatDuration(s)}
            </button>
          ))}
        </div>
      </section>
      <section className="card tools">
        <h3>Tools</h3>
        <button className="tool-row" onClick={() => setPlates(true)}><Icon name="plates" /> Plate calculator</button>
        <a className="tool-row" href="/api/export" download><Icon name="download" /> Export backup (JSON)</a>
      </section>
      {plates && <PlateSheet onClose={() => setPlates(false)} />}
    </div>
  );
}
