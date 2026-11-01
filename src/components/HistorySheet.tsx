import { useState } from 'react';
import { MUSCLE_BY_ID } from '../../shared/muscles.ts';
import { useData, useUi } from '../data.tsx';
import { bestSet, estimate1RM, formatDuration, formatKg, formatPb, formatSet, formatSets } from '../lib/stats.ts';
import { formatChange, progressSeries, repMaxes, trend, TREND_DAYS } from '../lib/trends.ts';
import { LineChart, type LinePoint } from './charts.tsx';
import { Sheet } from './Sheet.tsx';

const DAY = 86_400_000;
const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const longDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const RANGES = [
  { id: '3m', label: '3M', days: 91 },
  { id: '6m', label: '6M', days: 182 },
  { id: '1y', label: '1Y', days: 365 },
  { id: 'all', label: 'All', days: Infinity },
] as const;
type Range = (typeof RANGES)[number]['id'];

export function HistorySheet({ exerciseId, onClose }: { exerciseId: number; onClose: () => void }) {
  const { exById, entries, pbs, prEntryIds, now } = useData();
  const { openMuscle } = useUi();
  const [range, setRange] = useState<Range>('all');
  const ex = exById.get(exerciseId);
  if (!ex) return null;

  const mine = entries.filter((e) => e.exerciseId === ex.id);
  const pb = pbs.get(ex.id);
  const series = progressSeries(ex, mine);
  const span = series.points.length ? now - series.points[0].at : 0;
  // Only offer ranges shorter than the history itself.
  const ranges = RANGES.filter((r) => r.id === 'all' || r.days * DAY < span);
  const days = RANGES.find((r) => r.id === range)!.days;
  const shown = series.points.filter((p) => now - p.at <= days * DAY);
  const points: LinePoint[] = shown.map((p) => ({ x: p.at, y: p.y, mark: prEntryIds.has(p.entry.id) }));
  const byX = new Map(shown.map((p) => [p.at, p.entry]));
  const formatY = series.unit === 'seconds' ? formatDuration : series.unit === 'reps' ? (n: number) => `${n} reps` : formatKg;
  const best1RM = ex.metric === 'weight' && mine.length ? Math.max(...mine.flatMap((e) => e.sets.map(estimate1RM))) : null;
  const lately = trend(series.points, now);
  const bests = ex.metric === 'time' ? [] : repMaxes(mine);

  return (
    <Sheet
      title={ex.name}
      subtitle={`${MUSCLE_BY_ID[ex.muscle].name} · ${mine.length} session${mine.length === 1 ? '' : 's'}${mine.length ? ` since ${shortDate(Date.parse(mine[0].performedAt))}` : ''}`}
      onClose={onClose}
    >
      <div className="summary-stats">
        <div><strong>{pb ? formatPb(pb, ex.metric) : '—'}</strong><span>personal best</span></div>
        {best1RM != null && <div><strong>{formatKg(Math.round(best1RM * 2) / 2)}</strong><span>est. 1RM</span></div>}
        <div>
          <strong className={lately ? (lately.change > 0 ? 'up' : lately.change < 0 ? 'down' : '') : ''}>
            {lately ? formatChange(lately.change, series.unit) : '—'}
          </strong>
          <span>last {TREND_DAYS / 7} weeks</span>
        </div>
        <div><strong>{mine.filter((e) => prEntryIds.has(e.id)).length}</strong><span>PBs set</span></div>
      </div>

      {series.points.length > 1 ? (
        <section className="history-chart">
          <div className="card-head">
            <h3 className="section-title">{series.label}</h3>
            {ranges.length > 1 && (
              <div className="segmented small" role="radiogroup" aria-label="Time range">
                {ranges.map((r) => (
                  <button key={r.id} role="radio" aria-checked={range === r.id} className={range === r.id ? 'active' : ''} onClick={() => setRange(r.id)}>
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {points.length > 1 ? (
            <LineChart
              points={points}
              label={`${series.label} for ${ex.name} over time`}
              formatY={formatY}
              formatX={shortDate}
              extra={(p) => {
                const e = byX.get(p.x);
                if (!e) return null;
                // Show the set the plotted value came from.
                const set = series.unit === 'kg' ? e.sets.reduce((a, b) => (estimate1RM(b) > estimate1RM(a) ? b : a)) : bestSet(e.sets, ex.metric);
                return `${formatSet(set, ex.metric)}${p.mark ? ' · PB' : ''}`;
              }}
            />
          ) : (
            <p className="muted small">Only one session in this range.</p>
          )}
        </section>
      ) : (
        <p className="muted">Log this exercise a couple of times to see your progress chart.</p>
      )}

      {bests.length > 1 && (
        <section>
          <h3 className="section-title">Best sets</h3>
          <ul className="history full rep-maxes">
            {bests.map((r) => (
              <li key={r.reps}>
                <span className="muted">{r.reps} rep{r.reps === 1 ? '' : 's'}</span>
                <span>
                  <strong>{ex.metric === 'bodyweight' ? '+' : ''}{formatKg(r.weight)}</strong>
                  <span className="muted small">{longDate(Date.parse(r.performedAt))}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {mine.length > 0 && (
        <section>
          <h3 className="section-title">All sessions</h3>
          <ul className="history full">
            {[...mine].reverse().map((e) => (
              <li key={e.id}>
                <span className="muted">{shortDate(Date.parse(e.performedAt))}</span>
                <span>
                  {formatSets(e.sets, ex.metric)}
                  {prEntryIds.has(e.id) && <span className="pb-badge small">PB</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <button className="btn primary block" onClick={() => openMuscle(ex.muscle, ex.id)}>Log {ex.name}</button>
    </Sheet>
  );
}
