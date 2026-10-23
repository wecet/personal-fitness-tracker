import { useMemo, useState } from 'react';
import { MUSCLE_BY_ID } from '../../shared/muscles.ts';
import { StackedColumns } from '../components/charts.tsx';
import { useData } from '../data.tsx';
import { reviewYear, yearsWithData } from '../lib/review.ts';
import { formatKg } from '../lib/stats.ts';

const MONTHS = Array.from({ length: 12 }, (_, m) => new Date(2000, m, 1).toLocaleDateString(undefined, { month: 'short' }));
const round = (kg: number) => Math.round(kg * 2) / 2;

export function ReviewPage() {
  const { entries, activities, exById, prEntryIds } = useData();
  const years = useMemo(() => yearsWithData(entries, activities), [entries, activities]);
  const [year, setYear] = useState(years[0]);
  const r = useMemo(() => reviewYear(year, entries, activities, exById, prEntryIds), [year, entries, activities, exById, prEntryIds]);
  const maxMuscle = r.topMuscles[0]?.[1] ?? 1;
  const tonnes = r.volume / 1000;

  return (
    <div className="page">
      {years.length > 1 && (
        <div className="segmented small mode-switch" role="tablist" aria-label="Year">
          {years.map((y) => (
            <button key={y} role="tab" aria-selected={y === year} className={y === year ? 'active' : ''} onClick={() => setYear(y)}>{y}</button>
          ))}
        </div>
      )}

      <section className="card review-hero">
        <span className="eyebrow">Your {year}</span>
        <strong className="hero-figure">{r.activeDays}</strong>
        <span className="muted">active days · {r.gymDays} in the gym, {r.football.sessions} on the pitch</span>
      </section>

      <div className="review-grid">
        <div className="stat"><strong>{r.sets.toLocaleString()}</strong><span>sets</span></div>
        <div className="stat"><strong>{tonnes >= 10 ? Math.round(tonnes).toLocaleString() : tonnes.toFixed(1)} t</strong><span>lifted</span></div>
        <div className="stat"><strong>{r.pbs}</strong><span>PBs set</span></div>
        <div className="stat"><strong>{r.longestWeekStreak} wk</strong><span>longest streak</span></div>
        <div className="stat"><strong>{r.football.matches}</strong><span>matches</span></div>
        <div className="stat"><strong>{Math.round(r.football.minutes / 60)} h</strong><span>of football</span></div>
      </div>

      {(r.favourite || r.biggestLift || r.mostImproved) && (
        <section className="card highlights">
          {r.favourite && (
            <div><span className="eyebrow">Favourite exercise</span><strong>{r.favourite.exercise.name}</strong><span className="muted small">{r.favourite.sessions} sessions</span></div>
          )}
          {r.biggestLift && (
            <div><span className="eyebrow">Biggest lift</span><strong>{r.biggestLift.exercise.name}</strong><span className="muted small">≈ {formatKg(round(r.biggestLift.e1rm))} estimated 1RM</span></div>
          )}
          {r.mostImproved && (
            <div>
              <span className="eyebrow">Most improved</span><strong>{r.mostImproved.exercise.name}</strong>
              <span className="muted small">
                {formatKg(round(r.mostImproved.from))} → {formatKg(round(r.mostImproved.to))} e1RM (+{Math.round((r.mostImproved.to / r.mostImproved.from - 1) * 100)}%)
              </span>
            </div>
          )}
        </section>
      )}

      <section className="card">
        <h3>Active days by month</h3>
        <StackedColumns
          label={`Active days per month in ${year}, gym and football`}
          series={[{ name: 'Gym', color: 'var(--chart-1)' }, { name: 'Football', color: 'var(--chart-2)' }]}
          bars={r.months.map((m, i) => ({ label: MONTHS[i], title: `${MONTHS[i]} ${year}`, values: [m.gym, m.football] }))}
          formatY={(n) => `${n} day${n === 1 ? '' : 's'}`}
        />
      </section>

      {r.topMuscles.length > 0 && (
        <section className="card">
          <h3>Most trained muscles</h3>
          <ul className="muscle-bars">
            {r.topMuscles.map(([m, sets]) => (
              <li key={m}>
                <span>{MUSCLE_BY_ID[m].name}</span>
                <span className="muscle-bar"><span style={{ width: `${(sets / maxMuscle) * 100}%` }} /></span>
                <span className="muted small">{sets} sets</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
