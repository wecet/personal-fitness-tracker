import { useState } from 'react';
import { MUSCLES } from '../../shared/muscles.ts';
import { useData, useUi } from '../data.tsx';
import { Sparkline } from '../components/charts.tsx';
import { formatPb } from '../lib/stats.ts';
import { formatChange, progressSeries, trend, TREND_DAYS } from '../lib/trends.ts';

const SPARK_SESSIONS = 10;

/** "13 Oct", or "13 Oct 2025" for an older year. */
const pbDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }) });
};

export function RecordsPage() {
  const { exercises, pbs, entries, now } = useData();
  const { openHistory } = useUi();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const groups = MUSCLES.map((m) => ({
    muscle: m,
    items: exercises.filter((ex) => ex.muscle === m.id && pbs.has(ex.id) && ex.name.toLowerCase().includes(q)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="page">
      <input className="search" type="search" placeholder="Search exercises" value={query} onChange={(e) => setQuery(e.target.value)} />
      {groups.length === 0 && (
        <p className="muted empty">{pbs.size === 0 ? 'Log your first workout from the body map to start tracking PBs.' : 'No matches.'}</p>
      )}
      {groups.map(({ muscle, items }) => (
        <section className="card" key={muscle.id}>
          <h3>{muscle.name}</h3>
          <ul className="records">
            {items.map((ex) => {
              const pb = pbs.get(ex.id)!;
              const series = progressSeries(ex, entries.filter((e) => e.exerciseId === ex.id));
              const lately = trend(series.points, now);
              const dir = lately ? (lately.change > 0 ? 'up' : lately.change < 0 ? 'down' : '') : '';
              return (
                <li key={ex.id}>
                  <button onClick={() => openHistory(ex.id)}>
                    <span className="record-name">
                      {ex.name}
                      <span className="muted small">
                        {pbDate(pb.performedAt)}
                        {lately && <> <span className="nowrap">· <span className={`trend ${dir}`}>{formatChange(lately.change, series.unit)}</span> in {TREND_DAYS / 7} wk</span></>}
                      </span>
                    </span>
                    <Sparkline values={series.points.slice(-SPARK_SESSIONS).map((p) => p.y)} />
                    <span className="pb-badge">{formatPb(pb, ex.metric)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
