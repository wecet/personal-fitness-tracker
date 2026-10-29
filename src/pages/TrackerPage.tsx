import { useEffect, useMemo, useRef, useState } from 'react';
import { MUSCLE_BY_ID } from '../../shared/muscles.ts';
import type { Activity, Entry } from '../../shared/types.ts';
import { Icon } from '../components/Icon.tsx';
import { useData, useUi } from '../data.tsx';
import { groupByDay, level, type DayLog } from '../lib/days.ts';
import { EFFORT_LABEL, FOOTBALL_LABEL } from '../lib/football.ts';
import { dateKey, formatMinutes, formatSet, formatSets, parseDateKey, weekdayHabits, WEEKDAYS } from '../lib/stats.ts';

const DAY = 86_400_000;
const WEEKS_SHOWN = 53;
/** Cell (12px) + gap (3px) per week column, and the Mon/Wed/Fri label column. */
const WEEK_WIDTH = 15;
const DAY_LABEL_WIDTH = 30;
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

/** Monday on or before the given date. */
function startOfWeek(d: Date) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

function ContributionGraph({ byDay, selected, onSelect }: {
  byDay: Map<string, DayLog>;
  selected: string;
  onSelect: (key: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(WEEKS_SHOWN);
  const today = new Date();
  const todayKey = dateKey(today);
  const first = startOfWeek(today);
  first.setDate(first.getDate() - (shown - 1) * 7);

  // Show as many recent weeks as fit the card, so the graph never scrolls sideways.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const fit = Math.floor((e.contentRect.width - DAY_LABEL_WIDTH) / WEEK_WIDTH);
      setShown(Math.max(4, Math.min(WEEKS_SHOWN, fit)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const weeks = Array.from({ length: shown }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + w * 7 + d)),
  );

  return (
    <div className="graph-fit" ref={box}>
      <div className="graph">
        <div className="graph-days">
          {['Mon', '', 'Wed', '', 'Fri', '', ''].map((d, i) => <span key={i} style={{ gridRow: i + 2 }}>{d}</span>)}
        </div>
        {weeks.map((days, w) => (
          <div className="graph-week" key={w}>
            <span className="graph-month">
              {days[0].getDate() <= 7 ? days[0].toLocaleDateString(undefined, { month: 'short' }) : ''}
            </span>
            {days.map((d) => {
              const key = dateKey(d);
              const log = byDay.get(key);
              const sets = log?.entries.reduce((n, e) => n + e.sets.length, 0) ?? 0;
              const football = !!log?.activities.length;
              const future = key > todayKey;
              const label = `${d.toDateString()}: ${sets} sets${football ? ', football' : ''}`;
              return (
                <button
                  key={key}
                  className={`cell l${level(log?.volume ?? 0)} ${football ? 'fb' : ''} ${key === selected ? 'selected' : ''}`}
                  style={future ? { visibility: 'hidden' } : undefined}
                  title={label}
                  aria-label={label}
                  onClick={() => onSelect(key)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthCalendar({ byDay, selected, onSelect }: {
  byDay: Map<string, DayLog>;
  selected: string;
  onSelect: (key: string) => void;
}) {
  const sel = parseDateKey(selected);
  const [month, setMonth] = useState(() => new Date(sel.getFullYear(), sel.getMonth(), 1));
  useEffect(() => setMonth(new Date(sel.getFullYear(), sel.getMonth(), 1)), [selected]);

  const todayKey = dateKey(new Date());
  const gridStart = startOfWeek(month);
  const cells = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <div className="calendar">
      <div className="calendar-head">
        <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month"><Icon name="chevronLeft" /></button>
        <h3>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
        <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month"><Icon name="chevron" /></button>
      </div>
      <div className="calendar-grid">
        {MON_FIRST.map((d) => <span key={d} className="calendar-dow">{WEEKDAYS[d].slice(0, 1)}</span>)}
        {cells.map((d) => {
          const key = dateKey(d);
          const log = byDay.get(key);
          const cls = [
            'day',
            `l${level(log?.volume ?? 0)}`,
            log?.activities.length && 'fb',
            d.getMonth() !== month.getMonth() && 'outside',
            key === todayKey && 'today',
            key === selected && 'selected',
          ].filter(Boolean).join(' ');
          return (
            <button key={key} className={cls} onClick={() => onSelect(key)} disabled={key > todayKey}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayDetail({ dayKey, log }: { dayKey: string; log: DayLog | undefined }) {
  const entries = log?.entries ?? [];
  const activities = log?.activities ?? [];
  const { exById, prEntryIds, remove, sessions, efforts } = useData();
  const { openMuscle, openSummary } = useUi();
  const daySessions = sessions.filter((s) => s.endedAt && dateKey(s.startedAt) === dayKey);
  const date = parseDateKey(dayKey);
  const title = date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const muscles = [...new Set(entries.map((e) => exById.get(e.exerciseId)?.muscle).filter((m) => m !== undefined))];

  function confirmDelete(e: Entry) {
    const ex = exById.get(e.exerciseId);
    if (confirm(`Delete ${ex?.name} (${formatSets(e.sets, ex?.metric ?? 'weight')})?`)) remove('entry', e.id);
  }

  function confirmDeleteActivity(a: Activity) {
    if (confirm(`Delete ${FOOTBALL_LABEL[a.type].toLowerCase()} (${a.minutes} min)?`)) remove('activity', a.id);
  }

  return (
    <section className="card day-detail">
      <h3>{title}</h3>
      {entries.length === 0 && activities.length === 0 && <p className="muted">No workout logged.</p>}
      {daySessions.map((s) => (
        <button key={s.id} className="session-row" onClick={() => openSummary(s.id)}>
          <span>🏋️ Workout</span>
          <span className="muted small">
            {formatMinutes((Date.parse(s.endedAt!) - Date.parse(s.startedAt)) / 60_000)}
            {s.rpe && ` · effort ${s.rpe}`}
          </span>
          <Icon name="chevron" size={16} />
        </button>
      ))}
      {activities.length > 0 && (
        <ul className="day-entries football">
          {activities.map((a) => (
            <li key={a.id}>
              <div>
                <strong>⚽ {FOOTBALL_LABEL[a.type]}</strong>
                <div className="set-list">
                  <span>{a.minutes} min</span>
                  <span>Effort {a.rpe} · {EFFORT_LABEL[a.rpe]}</span>
                </div>
              </div>
              <button className="icon-btn small" onClick={() => confirmDeleteActivity(a)} aria-label="Delete football session"><Icon name="trash" size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      {entries.length > 0 && (
        <>
          <div className="chips">
            {muscles.map((m) => (
              <button key={m} className="chip" onClick={() => openMuscle(m)}>{MUSCLE_BY_ID[m].name}</button>
            ))}
          </div>
          <ul className="day-entries">
            {entries.map((e) => {
              const ex = exById.get(e.exerciseId);
              return (
                <li key={e.id}>
                  <div>
                    <strong>{ex?.name ?? 'Unknown exercise'}</strong>
                    {prEntryIds.has(e.id) && <span className="pb-badge small">PB</span>}
                    <div className="set-list">
                      {e.sets.map((s, i) => (
                        <span key={i}>
                          {formatSet(s, ex?.metric ?? 'weight')}
                          {efforts.get(e.id)?.[i] && (
                            <span className="rir" title="Estimated reps in reserve">
                              {' '}· {efforts.get(e.id)![i].rir < 0.5 ? 'to failure' : `~${Math.round(efforts.get(e.id)![i].rir)} RIR`}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button className="icon-btn small" onClick={() => confirmDelete(e)} aria-label="Delete entry"><Icon name="trash" size={16} /></button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function Habits() {
  const { entries, activities, exById, now } = useData();
  const habits = weekdayHabits(entries, exById, new Date(now), activities);
  const max = Math.max(1, ...habits.map((h) => Math.max(h.sessions, h.football)));
  return (
    <section className="card">
      <h3>Weekly rhythm <span className="muted small">· last 12 weeks</span></h3>
      <ul className="habits">
        {MON_FIRST.map((d) => {
          const h = habits[d];
          const gym = h.sessions >= 2 && h.focus ? h.focus : h.sessions ? 'Occasional' : null;
          const football = h.football >= 2 ? 'Football' : null;
          return (
            <li key={d}>
              <span className="habit-day">{WEEKDAYS[d].slice(0, 3)}</span>
              <span className="habit-bar">
                <span style={{ width: `${(h.sessions / max) * 100}%` }} />
                {h.football > 0 && <span className="fb" style={{ width: `${(h.football / max) * 100}%` }} />}
              </span>
              <span className="habit-focus">{[gym, football].filter(Boolean).join(' + ') || 'Rest'}</span>
              <span className="muted small">{Math.max(h.sessions, h.football)}/{h.occurrences}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function TrackerPage() {
  const { entries, activities, now } = useData();
  const byDay = useMemo(() => groupByDay(entries, activities), [entries, activities]);
  const [selected, setSelected] = useState(() => dateKey(new Date()));

  const daysSince = (n: number) => [...byDay.keys()].filter((k) => parseDateKey(k).getTime() > now - n * DAY).length;
  const weekStart = startOfWeek(new Date(now)).getTime();
  const thisWeek = [...byDay.keys()].filter((k) => parseDateKey(k).getTime() >= weekStart).length;

  return (
    <div className="page">
      <div className="stats">
        <div className="stat"><strong>{thisWeek}</strong><span>this week</span></div>
        <div className="stat"><strong>{daysSince(30)}</strong><span>last 30 days</span></div>
        <div className="stat"><strong>{byDay.size}</strong><span>all time</span></div>
      </div>
      <section className="card">
        <ContributionGraph byDay={byDay} selected={selected} onSelect={setSelected} />
        <div className="legend small">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((l) => <span key={l} className={`cell l${l}`} />)}
          <span>More</span>
          <span className="cell fb l0" />
          <span>Football</span>
        </div>
      </section>
      <div className="tracker-split">
        <section className="card"><MonthCalendar byDay={byDay} selected={selected} onSelect={setSelected} /></section>
        <DayDetail dayKey={selected} log={byDay.get(selected)} />
      </div>
      <Habits />
    </div>
  );
}
