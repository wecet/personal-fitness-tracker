import { useMemo } from 'react';
import { LineChart, StackedColumns, compact } from '../components/charts.tsx';
import { useData } from '../data.tsx';
import { HIGH_MONOTONY, monotony, weeklyLoad, ZONE_LABEL, type LoadZone } from '../lib/load.ts';

const ZONE_ICON: Record<LoadZone, string> = { baseline: '…', low: '↓', sweet: '✓', caution: '!', spike: '⚠' };
const ZONE_HINT: Record<LoadZone, string> = {
  baseline: 'Log about three weeks of training to unlock the ratio.',
  low: 'You’re training well below your recent average — fine for a deload, but fitness fades if it lasts.',
  sweet: 'This week matches what your body is used to. Keep building gradually.',
  caution: 'Load is climbing faster than usual. Hold steady rather than adding more.',
  spike: 'This week is far above your 4-week average — the pattern most linked to injuries. Ease off.',
};

const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const au = (n: number) => `${compact(Math.round(n))} AU`;

export function LoadPage() {
  const { daily, loadSeries, load, now } = useData();
  const weeks = useMemo(() => weeklyLoad(daily, new Date(now), 12), [daily, now]);
  const ratios = useMemo(
    () =>
      loadSeries
        .slice(-42)
        .filter((w) => w.zone !== 'baseline' && w.ratio != null)
        .map((w) => ({ x: w.day.getTime(), y: Math.round(w.ratio! * 100) / 100 })),
    [loadSeries],
  );
  const mono = useMemo(() => monotony(daily, new Date(now)), [daily, now]);

  return (
    <div className="page">
      <section className={`card load-hero zone-${load.zone}`}>
        <span className="eyebrow">Acute : chronic workload</span>
        <div className="load-hero-row">
          <strong className="hero-figure">{load.ratio == null || load.zone === 'baseline' ? '—' : load.ratio.toFixed(2)}</strong>
          <span className="zone-badge"><span aria-hidden="true">{ZONE_ICON[load.zone]}</span> {ZONE_LABEL[load.zone]}</span>
        </div>
        <p className="muted small">{ZONE_HINT[load.zone]}</p>
        <div className="load-split">
          <div><strong>{au(load.acute)}</strong><span>acute (per week)</span></div>
          <div><strong>{au(load.chronic)}</strong><span>chronic (per week)</span></div>
          <div className={mono.monotony != null && mono.monotony > HIGH_MONOTONY ? 'flag' : ''}>
            <strong>{mono.monotony == null ? '—' : mono.monotony.toFixed(1)}</strong>
            <span>monotony{mono.monotony != null && mono.monotony > HIGH_MONOTONY ? ' · vary days' : ''}</span>
          </div>
          <div><strong>{mono.strain == null ? '—' : au(mono.strain)}</strong><span>strain (7 days)</span></div>
        </div>
      </section>

      <section className="card">
        <h3>Weekly load</h3>
        <StackedColumns
          label="Weekly training load for the last 12 weeks, gym and football"
          series={[{ name: 'Gym', color: 'var(--chart-1)' }, { name: 'Football', color: 'var(--chart-2)' }]}
          bars={weeks.map((w) => ({ label: shortDate(w.start.getTime()), title: `Week of ${shortDate(w.start.getTime())}`, values: [w.gym, w.football] }))}
          formatY={au}
        />
      </section>

      <section className="card">
        <h3>Ratio over 6 weeks</h3>
        {ratios.length > 1 ? (
          <LineChart
            points={ratios}
            label="Acute to chronic workload ratio over the last six weeks"
            formatY={(n) => n.toFixed(2)}
            formatX={shortDate}
            band={{ from: 0.8, to: 1.3, label: 'Sweet spot 0.8–1.3' }}
            zeroBased
            area={false}
          />
        ) : (
          <p className="muted small">The ratio appears once you have about three weeks of history.</p>
        )}
      </section>

      <p className="muted small explainer">
        Load is minutes × effort (session RPE, Foster 2001). Gym sessions use the length and the effort you rate when finishing;
        unrated sets count ~3 minutes each at an effort estimated from their reps in reserve. Acute and chronic are 7- and 28-day
        exponentially weighted averages. Monotony above {HIGH_MONOTONY} means too little difference between hard and easy days.
        See Settings → How the numbers work for sources.
      </p>
    </div>
  );
}
