import { useMemo, useState, type FormEvent } from 'react';
import { LineChart } from '../components/charts.tsx';
import { Icon } from '../components/Icon.tsx';
import { useData } from '../data.tsx';
import { dateKey, formatKg, parseDateKey } from '../lib/stats.ts';

const DAY = 86_400_000;
const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Mean of weigh-ins in the 7 days up to and including `end`. */
function weekAverage(logs: { date: string; kg: number }[], end: number) {
  const window = logs.filter((l) => {
    const t = parseDateKey(l.date).getTime();
    return t <= end && t > end - 7 * DAY;
  });
  return window.length ? window.reduce((s, l) => s + l.kg, 0) / window.length : null;
}

export function BodyweightPage() {
  const { records, put, remove, now } = useData();
  const logs = useMemo(() => [...records.bodyweight].sort((a, b) => a.date.localeCompare(b.date)), [records.bodyweight]);
  const today = dateKey(new Date());
  const [date, setDate] = useState(today);
  const [kg, setKg] = useState(() => (logs.length ? String(logs[logs.length - 1].kg) : ''));

  const latest = logs[logs.length - 1];
  const avg = weekAverage(logs, now);
  const avgMonthAgo = weekAverage(logs, now - 30 * DAY);
  const change = avg != null && avgMonthAgo != null ? avg - avgMonthAgo : null;
  const value = Number(kg.replace(',', '.'));
  const valid = Number.isFinite(value) && value >= 20 && value <= 400;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    put('bodyweight', { id: `bw-${date}`, date, kg: Math.round(value * 10) / 10 });
  }

  return (
    <div className="page">
      <form className="card bw-form" onSubmit={submit}>
        <input inputMode="decimal" placeholder="Weight (kg)" value={kg} onChange={(e) => setKg(e.target.value)} aria-label="Weight in kg" />
        <input type="date" className="date-input" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} aria-label="Date" />
        <button className="btn primary" disabled={!valid}>{logs.some((l) => l.date === date) ? 'Update' : 'Log'}</button>
      </form>

      <div className="stats">
        <div className="stat"><strong>{latest ? formatKg(latest.kg) : '—'}</strong><span>latest</span></div>
        <div className="stat"><strong>{avg != null ? formatKg(Math.round(avg * 10) / 10) : '—'}</strong><span>7-day average</span></div>
        <div className="stat">
          <strong>{change != null ? `${change > 0 ? '+' : change < 0 ? '−' : '±'}${formatKg(Math.abs(Math.round(change * 10) / 10))}` : '—'}</strong>
          <span>vs 30 days ago</span>
        </div>
      </div>

      <section className="card">
        <h3>Trend</h3>
        {logs.length > 1 ? (
          <LineChart
            points={logs.map((l) => ({ x: parseDateKey(l.date).getTime(), y: l.kg }))}
            label="Bodyweight over time"
            formatY={(n) => formatKg(Math.round(n * 10) / 10)}
            formatX={shortDate}
          />
        ) : (
          <p className="muted small">Log a couple of weigh-ins to see the trend. Weigh at the same time each day for the cleanest line.</p>
        )}
      </section>

      {logs.length > 0 && (
        <section className="card">
          <h3>History</h3>
          <ul className="day-entries">
            {[...logs].reverse().slice(0, 30).map((l) => (
              <li key={l.id}>
                <span>{parseDateKey(l.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <strong>{formatKg(l.kg)}</strong>
                <button className="icon-btn small" onClick={() => remove('bodyweight', l.id)} aria-label={`Delete ${l.date}`}><Icon name="trash" size={16} /></button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
