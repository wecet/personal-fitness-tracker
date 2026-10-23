import { useState, type FormEvent } from 'react';
import { useData, useUi } from '../data.tsx';
import { bestSet, dateKey, formatKg, parseDateKey, type PersonalBest } from '../lib/stats.ts';
import type { Exercise, WorkoutSet } from '../../shared/types.ts';
import { Icon } from './Icon.tsx';

interface SetDraft {
  reps: string;
  weight: string;
}

const toDraft = (s: WorkoutSet): SetDraft => ({ reps: String(s.reps), weight: String(s.weight) });

function parse(drafts: SetDraft[]): WorkoutSet[] | null {
  const sets = drafts.map((d) => ({ reps: Number(d.reps), weight: d.weight.trim() === '' ? 0 : Number(d.weight.replace(',', '.')) }));
  return sets.every((s) => Number.isInteger(s.reps) && s.reps > 0 && Number.isFinite(s.weight) && s.weight >= 0) ? sets : null;
}

export function ExerciseLogger({ exercise, pb, onSaved }: { exercise: Exercise; pb?: PersonalBest; onSaved: () => void }) {
  const { entries, addEntry } = useData();
  const { notify } = useUi();
  const last = entries.findLast((e) => e.exerciseId === exercise.id);
  const today = dateKey(new Date());

  const [date, setDate] = useState(today);
  const [sets, setSets] = useState<SetDraft[]>(() => (last ? last.sets.map(toDraft) : [{ reps: '10', weight: '' }]));
  const [saving, setSaving] = useState(false);

  const parsed = parse(sets);
  const top = parsed && bestSet(parsed);
  const beatsPb = !!(pb && top && (top.weight > pb.weight || (top.weight === pb.weight && top.reps > pb.reps)));

  const update = (i: number, patch: Partial<SetDraft>) => setSets((s) => s.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!parsed) return;
    setSaving(true);
    try {
      const at = date === today ? new Date() : new Date(parseDateKey(date).setHours(12));
      const { isPb } = await addEntry({ exerciseId: exercise.id, performedAt: at.toISOString(), sets: parsed });
      notify(isPb ? `New PB! ${exercise.name} — ${formatKg(top!.weight)} × ${top!.reps}` : `Saved ${exercise.name}`, isPb ? 'pb' : 'default');
      onSaved();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="logger" onSubmit={submit}>
      <div className="logger-sets">
        <div className="set-row set-head">
          <span>Set</span>
          <span>Reps</span>
          <span />
          <span>Weight (kg)</span>
          <span />
        </div>
        {sets.map((s, i) => (
          <div className="set-row" key={i}>
            <span className="set-index">{i + 1}</span>
            <input aria-label={`Set ${i + 1} reps`} inputMode="numeric" value={s.reps} onChange={(e) => update(i, { reps: e.target.value })} />
            <span className="muted">×</span>
            <input aria-label={`Set ${i + 1} weight`} inputMode="decimal" placeholder="0" value={s.weight} onChange={(e) => update(i, { weight: e.target.value })} />
            <button type="button" className="icon-btn small" aria-label={`Remove set ${i + 1}`} disabled={sets.length === 1}
              onClick={() => setSets((all) => all.filter((_, j) => j !== i))}>
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
      <div className="logger-actions">
        <button type="button" className="btn ghost" onClick={() => setSets((all) => [...all, { ...all[all.length - 1] }])}>
          <Icon name="plus" size={16} /> Add set
        </button>
        <input type="date" className="date-input" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} aria-label="Workout date" />
      </div>
      {beatsPb && <p className="pb-hint">This beats your PB of {pb!.weight > 0 ? formatKg(pb!.weight) : `${pb!.reps} reps`} 🔥</p>}
      <button className="btn primary block" disabled={!parsed || saving}>
        {saving ? 'Saving…' : `Save ${sets.length} set${sets.length === 1 ? '' : 's'}`}
      </button>
    </form>
  );
}
