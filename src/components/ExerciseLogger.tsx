import { useEffect, useState, type FormEvent } from 'react';
import { useData, useUi } from '../data.tsx';
import { beats, bestSet, dateKey, formatPb, formatSet, parseDateKey, type PersonalBest } from '../lib/stats.ts';
import type { Exercise, ExerciseMetric, WorkoutSet } from '../../shared/types.ts';
import { suggestNext } from '../lib/progression.ts';
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

const COLUMNS: Record<ExerciseMetric, [string, string, string]> = {
  weight: ['Reps', '×', 'Weight (kg)'],
  bodyweight: ['Reps', '+', 'Added (kg)'],
  time: ['Time', '', 'Added (kg)'],
};

export function ExerciseLogger({ exercise, pb, onSaved }: { exercise: Exercise; pb?: PersonalBest; onSaved: () => void }) {
  const { entries, addEntry, activeSession } = useData();
  const { startRest } = useSession();
  const { notify } = useUi();
  const { metric } = exercise;
  const last = entries.findLast((e) => e.exerciseId === exercise.id);
  const today = dateKey(new Date());

  const [date, setDate] = useState(today);
  const [sets, setSets] = useState<SetDraft[]>(() => (last ? last.sets.map((s) => toDraft(s, metric)) : [blank()]));
  const [stopwatch, setStopwatch] = useState<{ index: number; startedAt: number } | null>(null);
  const [, tick] = useState(0);
  const suggestion = suggestNext(entries.filter((e) => e.exerciseId === exercise.id), exercise);
  const [applied, setApplied] = useState(false);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [plates, setPlates] = useState(false);

  useEffect(() => {
    if (!stopwatch) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [stopwatch]);

  const parsed = parse(sets, metric);
  const top = parsed && bestSet(parsed, metric);
  const beatsPb = !!(pb && top && beats(top, pb, metric));
  const [primaryLabel, joiner, weightLabel] = COLUMNS[metric];
  const repsLabel = exercise.kind === 'plyometric' ? (metric === 'weight' ? 'Throws' : 'Contacts') : primaryLabel;

  const update = (i: number, patch: Partial<SetDraft>) => setSets((s) => s.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const elapsed = (startedAt: number) => Math.max(1, Math.round((Date.now() - startedAt) / 1000));

  /** During a workout, ticking a set off starts the rest timer. */
  function toggleDone(i: number) {
    const next = new Set(done);
    if (next.has(i)) next.delete(i);
    else {
      next.add(i);
      startRest();
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

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!parsed) return;
    const at = date === today ? new Date() : new Date(parseDateKey(date).setHours(12));
    const { isPb } = addEntry({ exerciseId: exercise.id, performedAt: at.toISOString(), sets: parsed });
    notify(isPb ? `New PB! ${exercise.name} — ${formatSet(top!, metric)}` : `Saved ${exercise.name}`, isPb ? 'pb' : 'default');
    onSaved();
  }

  return (
    <form className="logger" onSubmit={submit}>
      {suggestion && (
        <div className="suggestion">
          <span className="suggestion-icon">↗</span>
          <span>{suggestion.detail}</span>
          <button type="button" className="pill" disabled={applied} onClick={() => {
            setSets(suggestion.sets.map((s) => toDraft(s, metric)));
            setApplied(true);
          }}>
            {applied ? 'Applied' : 'Apply'}
          </button>
        </div>
      )}
      {activeSession && <p className="muted small logger-hint">Tap a set number when it’s done to start your rest.</p>}
      <div className="logger-sets">
        <div className="set-row set-head">
          <span>Set</span>
          <span>{repsLabel}</span>
          <span />
          <span>{weightLabel}</span>
          <span />
        </div>
        {sets.map((s, i) => {
          const running = stopwatch?.index === i;
          return (
            <div className="set-row" key={i}>
              {activeSession ? (
                <button type="button" className={`set-index set-done ${done.has(i) ? 'done' : ''}`} aria-pressed={done.has(i)}
                  aria-label={`Set ${i + 1} done`} onClick={() => toggleDone(i)}>
                  {done.has(i) ? '✓' : i + 1}
                </button>
              ) : (
                <span className="set-index">{i + 1}</span>
              )}
              {metric === 'time' ? (
                <input aria-label={`Set ${i + 1} time`} inputMode="numeric" placeholder="0:30" readOnly={running}
                  className={running ? 'running' : ''}
                  value={running ? clock(elapsed(stopwatch.startedAt)) : s.time} onChange={(e) => update(i, { time: e.target.value })} />
              ) : (
                <input aria-label={`Set ${i + 1} reps`} inputMode="numeric" value={s.reps} onChange={(e) => update(i, { reps: e.target.value })} />
              )}
              {metric === 'time' ? (
                <button type="button" className={`icon-btn small stopwatch ${running ? 'running' : ''}`}
                  aria-label={running ? 'Stop timer' : 'Start timer'} onClick={() => toggleStopwatch(i)}>
                  <Icon name={running ? 'stop' : 'timer'} size={18} />
                </button>
              ) : (
                <span className="muted joiner">{joiner}</span>
              )}
              <input aria-label={`Set ${i + 1} weight`} inputMode="decimal" placeholder={metric === 'weight' ? '0' : 'BW'}
                value={s.weight} onChange={(e) => update(i, { weight: e.target.value })} />
              <button type="button" className="icon-btn small" aria-label={`Remove set ${i + 1}`} disabled={sets.length === 1}
                onClick={() => { setSets((all) => all.filter((_, j) => j !== i)); setDone(new Set()); }}>
                <Icon name="close" size={16} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="logger-actions">
        <button type="button" className="btn ghost" onClick={() => setSets((all) => [...all, { ...all[all.length - 1] }])}>
          <Icon name="plus" size={16} /> Add set
        </button>
        {metric === 'weight' && (
          <button type="button" className="icon-btn" aria-label="Plate calculator" onClick={() => setPlates(true)}>
            <Icon name="plates" />
          </button>
        )}
        <input type="date" className="date-input" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} aria-label="Workout date" />
      </div>
      {beatsPb && <p className="pb-hint">This beats your PB of {formatPb(pb!, metric)} 🔥</p>}
      <button className="btn primary block" disabled={!parsed || !!stopwatch}>
        {`Save ${sets.length} set${sets.length === 1 ? '' : 's'}`}
      </button>
      {plates && <PlateSheet initialKg={top?.weight || undefined} onClose={() => setPlates(false)} />}
    </form>
  );
}
