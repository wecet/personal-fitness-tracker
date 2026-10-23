import { MUSCLE_BY_ID } from '../../shared/muscles.ts';
import type { Entry, Exercise } from '../../shared/types.ts';
import { useData, useUi } from '../data.tsx';
import { bestSet, estimate1RM, formatDuration, formatKg, formatPb, formatSet, formatSets } from '../lib/stats.ts';
import { LineChart, type LinePoint } from './charts.tsx';
import { Sheet } from './Sheet.tsx';

const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** What the chart tracks for each kind of exercise. */
function measure(ex: Exercise, e: Entry): { y: number; label: string } {
  const top = bestSet(e.sets, ex.metric);
  if (ex.metric === 'time') return { y: top.seconds ?? 0, label: 'Longest hold' };
  if (ex.metric === 'bodyweight' && !e.sets.some((s) => s.weight > 0)) return { y: top.reps, label: 'Best set (reps)' };
  const best = Math.max(...e.sets.map(estimate1RM));
  return { y: Math.round(best * 10) / 10, label: ex.metric === 'bodyweight' ? 'Estimated 1RM (added kg)' : 'Estimated 1RM' };
}

export function HistorySheet({ exerciseId, onClose }: { exerciseId: number; onClose: () => void }) {
  const { exById, entries, pbs, prEntryIds } = useData();
  const { openMuscle } = useUi();
  const ex = exById.get(exerciseId);
  if (!ex) return null;

  const mine = entries.filter((e) => e.exerciseId === ex.id);
  const pb = pbs.get(ex.id);
  const measured = mine.map((e) => ({ e, ...measure(ex, e) }));
  const points: LinePoint[] = measured.map(({ e, y }) => ({ x: Date.parse(e.performedAt), y, mark: prEntryIds.has(e.id) }));
  const byX = new Map(measured.map(({ e }) => [Date.parse(e.performedAt), e]));
  const metricLabel = measured[0]?.label ?? 'Best';
  const formatY = ex.metric === 'time' ? formatDuration : metricLabel.includes('reps') ? (n: number) => `${n} reps` : formatKg;
  const best1RM = ex.metric === 'weight' && mine.length ? Math.max(...mine.flatMap((e) => e.sets.map(estimate1RM))) : null;

  return (
    <Sheet title={ex.name} subtitle={`${MUSCLE_BY_ID[ex.muscle].name} · ${mine.length} session${mine.length === 1 ? '' : 's'}`} onClose={onClose}>
      <div className="summary-stats">
        <div><strong>{pb ? formatPb(pb, ex.metric) : '—'}</strong><span>personal best</span></div>
        {best1RM != null && <div><strong>{formatKg(Math.round(best1RM * 2) / 2)}</strong><span>est. 1RM</span></div>}
        <div><strong>{mine.filter((e) => prEntryIds.has(e.id)).length}</strong><span>PBs set</span></div>
        <div><strong>{mine.length ? shortDate(Date.parse(mine[0].performedAt)) : '—'}</strong><span>first logged</span></div>
      </div>

      {points.length > 1 ? (
        <section>
          <h3 className="section-title">{metricLabel} · per session</h3>
          <LineChart
            points={points}
            label={`${metricLabel} for ${ex.name} over time`}
            formatY={formatY}
            formatX={shortDate}
            extra={(p) => {
              const e = byX.get(p.x);
              if (!e) return null;
              // Show the set the plotted value came from.
              const shown = metricLabel.includes('1RM') ? e.sets.reduce((a, b) => (estimate1RM(b) > estimate1RM(a) ? b : a)) : bestSet(e.sets, ex.metric);
              return `${formatSet(shown, ex.metric)}${p.mark ? ' · PB' : ''}`;
            }}
          />
        </section>
      ) : (
        <p className="muted">Log this exercise a couple of times to see your progress chart.</p>
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
