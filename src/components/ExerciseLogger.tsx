import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useData, useUi } from '../data.tsx';
import { beats, bestSet, dateKey, formatPb, formatSet, parseDateKey, type PersonalBest } from '../lib/stats.ts';
import { haptic } from '../lib/haptics.ts';
import { loadingStageName, rehabInjury } from '../lib/injuries.ts';
import type { Exercise, ExerciseMetric, WorkoutSet } from '../../shared/types.ts';
import { forReadiness, suggestNext } from '../lib/progression.ts';
import { warmupSets } from '../lib/warmup.ts';
import { useSession } from '../session.tsx';
import { Icon } from './Icon.tsx';
import { PlateSheet } from './PlateSheet.tsx';

interface SetDraft {
  reps: string;
  weight: string;
  /** "m:ss" or plain seconds. */
  time: string;
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

function parseTime(value: string): number {
  const parts = value.trim().split(':');
  if (parts.length > 2 || parts.some((p) => !/^\d+$/.test(p))) return NaN;
  return parts.length === 2 ? Number(parts[0]) * 60 + Number(parts[1]) : Number(parts[0]);
}

const toDraft = (s: WorkoutSet, metric: ExerciseMetric): SetDraft => ({
  reps: String(s.reps || 10),
  weight: s.weight > 0 || metric === 'weight' ? String(s.weight) : '',
  time: s.seconds ? clock(s.seconds) : '0:30',
});

const TONE_ICON = { up: '↗', hold: '→', down: '↘' } as const;

const blank = (): SetDraft => ({ reps: '10', weight: '', time: '0:30' });

function parse(drafts: SetDraft[], metric: ExerciseMetric): WorkoutSet[] | null {
  const sets = drafts.map((d) => {
    const weight = d.weight.trim() === '' ? 0 : Number(d.weight.replace(',', '.'));
    return metric === 'time' ? { reps: 0, weight, seconds: parseTime(d.time) } : { reps: Number(d.reps), weight };
  });
  const valid = sets.every(
    (s) =>
      Number.isFinite(s.weight) &&
      s.weight >= 0 &&
      (metric === 'time' ? Number.isInteger(s.seconds) && s.seconds! > 0 : Number.isInteger(s.reps) && s.reps > 0),
  );
  return valid ? sets : null;
}

const COLUMNS: Record<ExerciseMetric, [string, string]> = {
  weight: ['Reps', 'kg'],
  bodyweight: ['Reps', '+ kg'],
  time: ['Time', '+ kg'],
};

/** Loadable steps: 1 kg on light dumbbells, 2.5 kg on bars and machines. */
const kgStep = (kg: number, up: boolean) => (up ? kg >= 20 : kg > 20) ? 2.5 : 1;

/** The next value on the grid of steps, so 81 goes to 82.5 or 80 rather than 83.5 or 78.5. */
function stepValue(value: string, up: boolean, kind: 'reps' | 'kg'): string {
  const n = Number(value.replace(',', '.')) || 0;
  if (kind === 'reps') return String(Math.max(1, Math.round(n) + (up ? 1 : -1)));
  const step = kgStep(n, up);
  const next = up ? Math.floor(n / step + 1e-9) * step + step : Math.ceil(n / step - 1e-9) * step - step;
  return next <= 0 ? '' : String(Math.round(next * 100) / 100);
}

function Stepper({ label, value, kind, placeholder, onChange }: {
  label: string;
  value: string;
  kind: 'reps' | 'kg';
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const press = (up: boolean) => {
    haptic();
    onChange(stepValue(value, up, kind));
  };
  return (
    <div className="stepper">
      <button type="button" className="step" aria-label={`Less ${label}`} onClick={() => press(false)}>−</button>
      <input aria-label={label} inputMode={kind === 'kg' ? 'decimal' : 'numeric'} placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)} onFocus={(e) => e.target.select()} />
      <button type="button" className="step" aria-label={`More ${label}`} onClick={() => press(true)}>+</button>
    </div>
  );
}

/** How far a set row has to travel to count as a swipe. */
const SWIPE_DONE_PX = 64;

/** Swiping a set row to the right ticks it off, like tapping its number. */
function useSwipe(enabled: boolean, onSwipe: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const swipe = useRef(onSwipe);
  swipe.current = onSwipe;
  useEffect(() => {
    const row = ref.current;
    if (!row || !enabled) return;
    let start: { x: number; y: number } | null = null;
    let dragging = false;
    const place = (dx: number, animate: boolean) => {
      row.style.transition = animate ? 'translate var(--dur-base) var(--ease-out)' : 'none';
      row.style.translate = dx ? `${dx}px 0` : '';
      row.classList.toggle('swiping', dx >= SWIPE_DONE_PX);
    };
    const onStart = (e: TouchEvent) => {
      if ((e.target as Element).closest('input')) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      dragging = false;
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const dx = e.touches[0].clientX - start.x;
      const dy = e.touches[0].clientY - start.y;
      if (!dragging) {
        if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) return void (start = null);
        if (dx < 8) return;
        dragging = true;
      }
      // Resist past the threshold so it feels like it clicks into place.
      place(dx < SWIPE_DONE_PX ? Math.max(0, dx) : SWIPE_DONE_PX + (dx - SWIPE_DONE_PX) * 0.25, false);
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const dx = (e.changedTouches[0]?.clientX ?? start.x) - start.x;
      start = null;
      if (dragging && dx >= SWIPE_DONE_PX) swipe.current();
      if (dragging) place(0, true);
      dragging = false;
    };
    row.addEventListener('touchstart', onStart, { passive: true });
    row.addEventListener('touchmove', onMove, { passive: true });
    row.addEventListener('touchend', onEnd);
    row.addEventListener('touchcancel', onEnd);
    return () => {
      row.removeEventListener('touchstart', onStart);
      row.removeEventListener('touchmove', onMove);
      row.removeEventListener('touchend', onEnd);
      row.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled]);
  return ref;
}

function SetRow({ index, draft, metric, repsLabel, done, inSession, stopwatch, onDone, onChange, onStopwatch }: {
  index: number;
  draft: SetDraft;
  metric: ExerciseMetric;
  repsLabel: string;
  done: boolean;
  inSession: boolean;
  stopwatch: number | null;
  onDone: () => void;
  onChange: (patch: Partial<SetDraft>) => void;
  onStopwatch: () => void;
}) {
  const ref = useSwipe(inSession, onDone);
  const running = stopwatch != null;
  const n = index + 1;
  return (
    <div className={`set-row ${done ? 'is-done' : ''}`} ref={ref}>
      {inSession ? (
        <button type="button" className={`set-index set-done ${done ? 'done' : ''}`} aria-pressed={done} aria-label={`Set ${n} done`} onClick={onDone}>
          {done ? '✓' : n}
        </button>
      ) : (
        <span className="set-index">{n}</span>
      )}
      {metric === 'time' ? (
        <div className="stepper timed">
          <input aria-label={`Set ${n} time`} inputMode="numeric" placeholder="0:30" readOnly={running} className={running ? 'running' : ''}
            value={running ? clock(stopwatch) : draft.time} onChange={(e) => onChange({ time: e.target.value })} />
          <button type="button" className={`step stopwatch ${running ? 'running' : ''}`} aria-label={running ? 'Stop timer' : 'Start timer'} onClick={onStopwatch}>
            <Icon name={running ? 'stop' : 'timer'} size={18} />
          </button>
        </div>
      ) : (
        <Stepper label={`set ${n} ${repsLabel.toLowerCase()}`} value={draft.reps} kind="reps" onChange={(reps) => onChange({ reps })} />
      )}
      <Stepper label={`set ${n} weight`} value={draft.weight} kind="kg" placeholder={metric === 'weight' ? '0' : 'BW'} onChange={(weight) => onChange({ weight })} />
    </div>
  );
}

/** Just what to do: "… two sessions running — go up to 65 kg." becomes "Go up to 65 kg." */
const brief = (detail: string) => {
  const what = detail.split(' — ').at(-1)!;
  return what[0].toUpperCase() + what.slice(1);
};

const shortDate = (key: string) => parseDateKey(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

const sameSets = (a: WorkoutSet[], b: WorkoutSet[]) => JSON.stringify(a) === JSON.stringify(b);

export function ExerciseLogger({ exercise, pb, onSaved, onSetDone }: {
  exercise: Exercise;
  pb?: PersonalBest;
  onSaved: () => void;
  /** In a superset the pair decides when to rest; otherwise ticking a set off starts it. */
  onSetDone?: (index: number) => void;
}) {
  const { entries, sessions, injuries, now, addEntry, activeSession, readiness } = useData();
  const { startRest } = useSession();
  const { notify } = useUi();
  const { metric } = exercise;
  const last = entries.findLast((e) => e.exerciseId === exercise.id);
  const today = dateKey(new Date());

  const rehab = rehabInjury(injuries, exercise.muscle);
  const rpe = (e: { sessionId?: string | null }) => sessions.find((s) => s.id === e.sessionId)?.rpe;
  const [suggestion] = useState(() => {
    const next = rehab || !last ? null : suggestNext(entries.filter((e) => e.exerciseId === exercise.id), exercise, { now, rpe });
    return next && last ? forReadiness(next, last, exercise, readiness) : next;
  });

  const [date, setDate] = useState(today);
  // Opens on today's target when there is one, else on what you did last time.
  const [sets, setSets] = useState<SetDraft[]>(() => (suggestion ?? last)?.sets.map((s) => toDraft(s, metric)) ?? [blank()]);
  const [usingLast, setUsingLast] = useState(!suggestion);
  const [stopwatch, setStopwatch] = useState<{ index: number; startedAt: number } | null>(null);
  const [, tick] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [warmDone, setWarmDone] = useState<Set<number>>(new Set());
  const [plates, setPlates] = useState(false);

  useEffect(() => {
    if (!stopwatch) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [stopwatch]);

  const parsed = parse(sets, metric);
  const top = parsed && bestSet(parsed, metric);
  const beatsPb = !!(pb && top && beats(top, pb, metric));
  const [primaryLabel, weightLabel] = COLUMNS[metric];
  const repsLabel = exercise.kind === 'plyometric' ? (metric === 'weight' ? 'Throws' : 'Contacts') : primaryLabel;
  const warmups = rehab || !parsed ? [] : warmupSets(exercise, parsed);
  const inSession = !!activeSession;

  const update = (i: number, patch: Partial<SetDraft>) => setSets((s) => s.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const elapsed = (startedAt: number) => Math.max(1, Math.round((Date.now() - startedAt) / 1000));

  /** During a workout, ticking a set off starts the rest timer. */
  function toggleDone(i: number) {
    const next = new Set(done);
    if (next.has(i)) next.delete(i);
    else {
      next.add(i);
      haptic('success');
      if (onSetDone) onSetDone(i);
      else startRest();
    }
    setDone(next);
  }

  function toggleStopwatch(i: number) {
    if (stopwatch?.index === i) {
      update(i, { time: clock(elapsed(stopwatch.startedAt)) });
      setStopwatch(null);
    } else {
      setStopwatch({ index: i, startedAt: Date.now() });
    }
  }

  function switchTo(lastTime: boolean) {
    const source = lastTime ? last : suggestion;
    if (!source) return;
    setSets(source.sets.map((s) => toDraft(s, metric)));
    setUsingLast(lastTime);
    setDone(new Set());
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!parsed) return;
    const at = date === today ? new Date() : new Date(parseDateKey(date).setHours(12));
    const { isPb } = addEntry({ exerciseId: exercise.id, performedAt: at.toISOString(), sets: parsed });
    haptic(isPb ? 'success' : 'tap');
    notify(isPb ? `New PB! ${exercise.name} — ${formatSet(top!, metric)}` : `Saved ${exercise.name}`, isPb ? 'pb' : 'default');
    onSaved();
  }

  return (
    <form className="logger" onSubmit={submit}>
      {rehab ? (
        <div className="suggestion rehab">
          <span className="suggestion-icon">+</span>
          <span>
            <strong>Rehab sets only.</strong> Keep it light and pain-free until you clear “{loadingStageName(rehab)}”.
          </span>
        </div>
      ) : suggestion && last && (
        <div className={`suggestion ${usingLast ? 'hold' : suggestion.tone}`}>
          <span className="suggestion-icon" aria-hidden="true">{usingLast ? '↺' : TONE_ICON[suggestion.tone]}</span>
          <span>{usingLast ? 'Same as last time.' : brief(suggestion.detail)}</span>
          {!sameSets(suggestion.sets, last.sets) && (
            <button type="button" className="pill" onClick={() => switchTo(!usingLast)}>
              {usingLast ? 'Suggested' : 'Last time'}
            </button>
          )}
        </div>
      )}

      {warmups.length > 0 && (
        <div className="warmup" role="group" aria-label="Warm-up sets, not saved">
          <span className="warmup-label">Warm-up</span>
          {warmups.map((w, i) => (
            <button key={i} type="button" className={`warmup-set ${warmDone.has(i) ? 'done' : ''}`} aria-pressed={warmDone.has(i)}
              onClick={() => setWarmDone((cur) => {
                const next = new Set(cur);
                if (next.has(i)) next.delete(i);
                else next.add(i);
                return next;
              })}>
              {w.weight}<span className="unit">×{w.reps}</span>
            </button>
          ))}
        </div>
      )}

      <div className="logger-sets">
        <div className="set-row set-head">
          <span>Set</span>
          <span>{repsLabel}</span>
          <span>{weightLabel}</span>
        </div>
        {sets.map((s, i) => (
          <SetRow key={i} index={i} draft={s} metric={metric} repsLabel={repsLabel} done={done.has(i)} inSession={inSession}
            stopwatch={stopwatch?.index === i ? elapsed(stopwatch.startedAt) : null}
            onDone={() => toggleDone(i)} onChange={(patch) => update(i, patch)} onStopwatch={() => toggleStopwatch(i)} />
        ))}
        {inSession && done.size === 0 && <p className="muted small logger-hint">Tap or swipe a set when it’s done to start your rest.</p>}
      </div>

      <div className="logger-actions">
        <button type="button" className="btn ghost" onClick={() => setSets((all) => [...all, { ...all[all.length - 1] }])}>
          + Set
        </button>
        <button type="button" className="btn ghost" disabled={sets.length === 1} aria-label="Remove last set"
          onClick={() => { setSets((all) => all.slice(0, -1)); setDone((cur) => new Set([...cur].filter((i) => i < sets.length - 1))); }}>
          − Set
        </button>
        {metric === 'weight' && (
          <button type="button" className="icon-btn" aria-label="Plate calculator" onClick={() => setPlates(true)}>
            <Icon name="plates" />
          </button>
        )}
        <label className="date-chip">
          <Icon name="calendar" size={16} />
          <span>{date === today ? 'Today' : shortDate(date)}</span>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} aria-label="Workout date" />
        </label>
      </div>
      {beatsPb && <p className="pb-hint">This beats your PB of {formatPb(pb!, metric)} 🔥</p>}
      <button className="btn primary block" disabled={!parsed || !!stopwatch}>
        {`Save ${sets.length} set${sets.length === 1 ? '' : 's'}`}
      </button>
      {plates && <PlateSheet initialKg={top?.weight || undefined} onClose={() => setPlates(false)} />}
    </form>
  );
}
