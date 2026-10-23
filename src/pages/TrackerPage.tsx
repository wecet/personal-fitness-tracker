import { useEffect, useMemo, useRef, useState } from 'react';
import { MUSCLE_BY_ID } from '../../shared/muscles.ts';
import type { Entry } from '../../shared/types.ts';
import { Icon } from '../components/Icon.tsx';
import { useData, useUi } from '../data.tsx';
import { dateKey, formatSet, formatSets, parseDateKey, weekdayHabits, WEEKDAYS } from '../lib/stats.ts';

const DAY = 86_400_000;
const WEEKS_SHOWN = 53;
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

/** Intensity bucket 0–4 by number of sets logged that day. */
const level = (sets: number) => (sets === 0 ? 0 : sets < 9 ? 1 : sets < 16 ? 2 : sets < 23 ? 3 : 4);

/** Monday on or before the given date. */
function startOfWeek(d: Date) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

function useEntriesByDay(entries: Entry[]) {
  return useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      const k = dateKey(e.performedAt);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return map;
  }, [entries]);
}

function ContributionGraph({ byDay, selected, onSelect }: {
  byDay: Map<string, Entry[]>;
  selected: string;
  onSelect: (key: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const today = new Date();
  const todayKey = dateKey(today);
  const first = startOfWeek(today);
  first.setDate(first.getDate() - (WEEKS_SHOWN - 1) * 7);

  const weeks = Array.from({ length: WEEKS_SHOWN }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + w * 7 + d)),
  );

  useEffect(() => {
    scroller.current?.scrollTo({ left: scroller.current.scrollWidth });
  }, []);

  return (
    <div className="graph-scroll" ref={scroller}>
      <div className="graph">
        <div className="graph-days">
          {['Mon', '', 'Wed', '', 'Fri', '', ''].map((d, i) => <span key={i}>{d}</span>)}
        </div>
        {weeks.map((days, w) => (
          <div className="graph-week" key={w}>
            <span className="graph-month">
              {days[0].getDate() <= 7 ? days[0].toLocaleDateString(undefined, { month: 'short' }) : ''}
            </span>
            {days.map((d) => {
              const key = dateKey(d);
              const dayEntries = byDay.get(key) ?? [];
              const sets = dayEntries.reduce((n, e) => n + e.sets.length, 0);
              const future = key > todayKey;
              return (
                <button
                  key={key}
                  className={`cell l${level(sets)} ${key === selected ? 'selected' : ''}`}
                  style={future ? { visibility: 'hidden' } : undefined}
                  title={`${d.toDateString()}: ${sets} sets`}
                  aria-label={`${d.toDateString()}, ${sets} sets`}
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
  byDay: Map<string, Entry[]>;
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
          const sets = (byDay.get(key) ?? []).reduce((n, e) => n + e.sets.length, 0);
          const cls = [
            'day',
            `l${level(sets)}`,
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

function DayDetail({ dayKey, entries }: { dayKey: string; entries: Entry[] }) {
  const { exById, prEntryIds, remove } = useData();
  const { openMuscle } = useUi();
  const date = parseDateKey(dayKey);
  const title = date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const muscles = [...new Set(entries.map((e) => exById.get(e.exerciseId)?.muscle).filter((m) => m !== undefined))];

  function confirmDelete(e: Entry) {
    const ex = exById.get(e.exerciseId);
    if (confirm(`Delete ${ex?.name} (${formatSets(e.sets, ex?.metric ?? 'weight')})?`)) remove('entry', e.id);
  }

  return (
    <section className="card day-detail">
      <h3>{title}</h3>
      {entries.length === 0 ? (
        <p className="muted">No workout logged.</p>
      ) : (
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
                        <span key={i}>{formatSet(s, ex?.metric ?? 'weight')}</span>
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
  const { entries, exById, now } = useData();
  const habits = weekdayHabits(entries, exById, new Date(now));
  const max = Math.max(1, ...habits.map((h) => h.sessions));
  return (
    <section className="card">
      <h3>Weekly rhythm <span className="muted small">· last 12 weeks</span></h3>
      <ul className="habits">
        {MON_FIRST.map((d) => {
          const h = habits[d];
          return (
            <li key={d}>
              <span className="habit-day">{WEEKDAYS[d].slice(0, 3)}</span>
              <span className="habit-bar"><span style={{ width: `${(h.sessions / max) * 100}%` }} /></span>
              <span className="habit-focus">{h.sessions >= 2 && h.focus ? h.focus : h.sessions ? 'Occasional' : 'Rest'}</span>
              <span className="muted small">{h.sessions}/{h.occurrences}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function TrackerPage() {
  const { entries, now } = useData();
  const byDay = useEntriesByDay(entries);
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
        </div>
      </section>
      <div className="tracker-split">
        <section className="card"><MonthCalendar byDay={byDay} selected={selected} onSelect={setSelected} /></section>
        <DayDetail dayKey={selected} entries={byDay.get(selected) ?? []} />
      </div>
      <Habits />
    </div>
  );
}
