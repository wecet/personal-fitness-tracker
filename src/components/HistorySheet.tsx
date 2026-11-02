import { useState } from 'react';
import { MUSCLE_BY_ID } from '../../shared/muscles.ts';
import { useData, useUi } from '../data.tsx';
import { bestSet, estimate1RM, formatDuration, formatKg, formatPb, formatSet, formatSets } from '../lib/stats.ts';
import { bestSoFar, chartViews, formatChange, repMaxes, topSet, trend, TREND_DAYS, VIEW_LABEL, viewSeries, type ChartView } from '../lib/trends.ts';
import { LineChart, type LinePoint } from './charts.tsx';
import { Sheet } from './Sheet.tsx';
import { Num } from './Num.tsx';

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
  const views = ex ? chartViews(ex) : [];
  const [view, setView] = useState<ChartView>(views[0] ?? 'top');
  if (!ex) return null;

  const mine = entries.filter((e) => e.exerciseId === ex.id);
  const pb = pbs.get(ex.id);
  const series = viewSeries(ex, mine, view);
  const span = series.points.length ? now - series.points[0].at : 0;
  // Only offer ranges shorter than the history itself.
  const ranges = RANGES.filter((r) => r.id === 'all' || r.days * DAY < span);
  const days = RANGES.find((r) => r.id === range)!.days;
  const start = now - days * DAY;
  const shown = series.points.filter((p) => p.at >= start);
  const byX = new Map(shown.map((p) => [p.at, p.entry]));
  const formatY =
    series.unit === 'seconds' ? formatDuration
    : series.unit === 'reps' ? (n: number) => `${n} reps`
    : series.added ? (n: number) => `+${formatKg(n)}`
    : formatKg;

  // Est. 1RM is a smooth line with PBs marked; every other view is a staircase of bests over the session dots.
  const staircase = view !== '1rm';
  const steps = bestSoFar(series.points);
  // The staircase starts at whatever your best already was when the range begins.
  const before = steps.filter((st) => st.at < (shown[0]?.at ?? 0)).at(-1);
  const visibleSteps = [...(before && shown[0] ? [{ at: shown[0].at, y: before.y }] : []), ...steps.filter((st) => st.at >= (shown[0]?.at ?? Infinity))];
  // Dots mark your PBs (heavier, or more reps at the same weight), matching the badges below. Total reps has no PB, so its new bests are marked instead.
  const isStep = new Set(steps.map((st) => st.at));
  const marks = (p: (typeof shown)[number]) => (view === 'total' ? isStep.has(p.at) : prEntryIds.has(p.entry.id));
  const points: LinePoint[] = shown.map((p) => ({ x: p.at, y: p.y, mark: marks(p) }));
  const markLabel = view === 'total' ? 'New best' : 'PB';

  /** The set (or sets) a plotted value came from. */
  const source = (p: LinePoint) => {
    const e = byX.get(p.x);
    if (!e) return null;
    const what =
      view === 'top' || (view === 'best' && series.unit === 'kg') ? formatSet(topSet(e.sets), ex.metric)
      : view === 'total' ? formatSets(e.sets, ex.metric)
      : view === '1rm' ? formatSet(e.sets.reduce((a, b) => (estimate1RM(b) > estimate1RM(a) ? b : a)), ex.metric)
      : formatSet(bestSet(e.sets, ex.metric), ex.metric);
    return `${what}${p.mark ? ` · ${markLabel}` : ''}`;
  };
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
        <div><strong><Num>{pb ? formatPb(pb, ex.metric) : '—'}</Num></strong><span>personal best</span></div>
        {best1RM != null && <div><strong><Num>{formatKg(Math.round(best1RM * 2) / 2)}</Num></strong><span>est. 1RM</span></div>}
        <div>
          <strong className={lately ? (lately.change > 0 ? 'up' : lately.change < 0 ? 'down' : '') : ''} title={VIEW_LABEL[view]}>
            {lately ? formatChange(lately.change, series.unit) : '—'}
          </strong>
          <span>last {TREND_DAYS / 7} weeks</span>
        </div>
        <div><strong><Num>{mine.filter((e) => prEntryIds.has(e.id)).length}</Num></strong><span>PBs set</span></div>
      </div>

      {series.points.length > 1 ? (
        <section className="history-chart">
          <h3 className="section-title">Progress</h3>
          <div className="chart-controls">
            {views.length > 1 && (
              <div className="segmented small" role="radiogroup" aria-label="What to chart">
                {views.map((v) => (
                  <button key={v} role="radio" aria-checked={view === v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
                    {VIEW_LABEL[v]}
                  </button>
                ))}
              </div>
            )}
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
              label={`${VIEW_LABEL[view]} for ${ex.name} over time`}
              formatY={formatY}
              formatX={shortDate}
              extra={source}
              best={staircase ? { points: visibleSteps.map((st) => ({ x: st.at, y: st.y })), label: 'Best so far', pointLabel: 'Session', markLabel } : undefined}
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
