import { useState, type FormEvent } from 'react';
import { MUSCLE_BY_ID, type MuscleId } from '../../shared/muscles.ts';
import type { Exercise } from '../../shared/types.ts';
import { useData, useUi } from '../data.tsx';
import { exercisesFor, formatPb, formatSets, recoveryLabel } from '../lib/stats.ts';
import { ExerciseLogger } from './ExerciseLogger.tsx';
import { Icon } from './Icon.tsx';
import { Sheet } from './Sheet.tsx';

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function ExerciseRow({ exercise, open, onToggle }: { exercise: Exercise; open: boolean; onToggle: () => void }) {
  const { entries, pbs } = useData();
  const pb = pbs.get(exercise.id);
  const history = entries.filter((e) => e.exerciseId === exercise.id).slice(-3).reverse();

  return (
    <li className={`exercise ${open ? 'open' : ''}`}>
      <button className="exercise-head" onClick={onToggle} aria-expanded={open}>
        <span className="exercise-name">{exercise.name}</span>
        {pb ? <span className="pb-badge">PB {formatPb(pb)}</span> : <span className="muted small">No PB yet</span>}
        <span className="chevron"><Icon name="chevron" size={18} /></span>
      </button>
      {open && (
        <div className="exercise-body">
          <ExerciseLogger exercise={exercise} pb={pb} onSaved={onToggle} />
          {history.length > 0 && (
            <ul className="history">
              {history.map((e) => (
                <li key={e.id}>
                  <span className="muted">{shortDate(e.performedAt)}</span>
                  <span>{formatSets(e.sets)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function AddExercise({ muscle }: { muscle: MuscleId }) {
  const { addExercise } = useData();
  const { notify } = useUi();
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await addExercise({ name, muscle });
      setName('');
      setOpen(false);
    } catch (err) {
      notify((err as Error).message, 'error');
    }
  }

  if (!open)
    return (
      <button className="btn ghost block" onClick={() => setOpen(true)}>
        <Icon name="plus" size={16} /> Add a custom exercise
      </button>
    );
  return (
    <form className="add-exercise" onSubmit={submit}>
      <input autoFocus placeholder="Exercise name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      <button className="btn primary" disabled={!name.trim()}>Add</button>
    </form>
  );
}

export function MuscleSheet({ muscle, exerciseId, onClose }: { muscle: MuscleId; exerciseId?: number; onClose: () => void }) {
  const { exercises, entries, fatigue } = useData();
  const [openId, setOpenId] = useState<number | null>(exerciseId ?? null);
  const info = MUSCLE_BY_ID[muscle];
  const f = fatigue.get(muscle);
  const primary = exercisesFor(muscle, exercises, entries);
  const assisting = exercises.filter((ex) => ex.secondary.includes(muscle));
  const toggle = (id: number) => setOpenId((cur) => (cur === id ? null : id));

  return (
    <Sheet
      title={info.name}
      subtitle={<span className={f?.hoursLeft ? 'status recovering' : 'status ready'}>{recoveryLabel(f)}</span>}
      onClose={onClose}
    >
      <ul className="exercise-list">
        {primary.map((ex) => (
          <ExerciseRow key={ex.id} exercise={ex} open={openId === ex.id} onToggle={() => toggle(ex.id)} />
        ))}
      </ul>
      <AddExercise muscle={muscle} />
      {assisting.length > 0 && (
        <details className="assisting" open={assisting.some((ex) => ex.id === exerciseId)}>
          <summary>Also works {info.name.toLowerCase()} ({assisting.length})</summary>
          <ul className="exercise-list">
            {assisting.map((ex) => (
              <ExerciseRow key={ex.id} exercise={ex} open={openId === ex.id} onToggle={() => toggle(ex.id)} />
            ))}
          </ul>
        </details>
      )}
    </Sheet>
  );
}
