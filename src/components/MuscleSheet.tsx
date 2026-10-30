import { useState, type FormEvent } from 'react';
import { MUSCLE_BY_ID, type MuscleId } from '../../shared/muscles.ts';
import { EXERCISE_KINDS, EXERCISE_METRICS, type Exercise, type ExerciseKind, type ExerciseMetric } from '../../shared/types.ts';
import { useData, useUi } from '../data.tsx';
import { daysOut, injuryLabel, isActive } from '../lib/injuries.ts';
import { exercisesFor, formatPb, formatSets, recoveryLabel } from '../lib/stats.ts';
import { ExerciseLogger } from './ExerciseLogger.tsx';
import { Icon } from './Icon.tsx';
import { Sheet } from './Sheet.tsx';

const METRIC_LABEL: Record<ExerciseMetric, string> = { weight: 'Weight × reps', bodyweight: 'Bodyweight', time: 'Timed' };

export const KIND_LABEL: Record<ExerciseKind, string> = { strength: 'Strength', plyometric: 'Plyometric', mobility: 'Mobility' };

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export function ExerciseRow({ exercise, open, onToggle, detail }: { exercise: Exercise; open: boolean; onToggle: () => void; detail?: string }) {
  const { entries, pbs } = useData();
  const { openHistory } = useUi();
  const pb = pbs.get(exercise.id);
  const history = entries.filter((e) => e.exerciseId === exercise.id).slice(-3).reverse();
  const status =
    exercise.kind !== 'strength'
      ? <span className="muted small">{history[0] ? `Last ${shortDate(history[0].performedAt)}` : 'Not done yet'}</span>
      : pb ? <span className="pb-badge">PB {formatPb(pb, exercise.metric)}</span> : <span className="muted small">No PB yet</span>;

  return (
    <li className={`exercise ${open ? 'open' : ''}`}>
      <button className="exercise-head" onClick={onToggle} aria-expanded={open}>
        <span className="exercise-name">
          {exercise.name}
          {detail && <span className="exercise-detail">{detail}</span>}
        </span>
        {status}
        <span className="chevron"><Icon name="chevron" size={18} /></span>
      </button>
      {open && (
        <div className="exercise-body">
          <ExerciseLogger exercise={exercise} pb={pb} onSaved={onToggle} />
          {history.length > 0 && (
            <>
            <button className="link" onClick={() => openHistory(exercise.id)}>Progress chart & full history →</button>
            <ul className="history">
              {history.map((e) => (
                <li key={e.id}>
                  <span className="muted">{shortDate(e.performedAt)}</span>
                  <span>{formatSets(e.sets, exercise.metric)}</span>
                </li>
              ))}
            </ul>
            </>
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
  const [metric, setMetric] = useState<ExerciseMetric>('weight');
  const [kind, setKind] = useState<ExerciseKind>('strength');
  const [open, setOpen] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await addExercise({ name, muscle, metric, kind });
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
      <div className="add-exercise-row">
        <input autoFocus placeholder="Exercise name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <button className="btn primary" disabled={!name.trim()}>Add</button>
      </div>
      <div className="segmented small" role="radiogroup" aria-label="Measured by">
        {EXERCISE_METRICS.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={metric === m} className={metric === m ? 'active' : ''} onClick={() => setMetric(m)}>
            {METRIC_LABEL[m]}
          </button>
        ))}
      </div>
      <div className="segmented small" role="radiogroup" aria-label="Type">
        {EXERCISE_KINDS.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
    </form>
  );
}

export function MuscleSheet({ muscle, exerciseId, onClose }: { muscle: MuscleId; exerciseId?: number; onClose: () => void }) {
  const { exercises, entries, fatigue, injuries } = useData();
  const { openInjury } = useUi();
  const [openId, setOpenId] = useState<number | null>(exerciseId ?? null);
  const info = MUSCLE_BY_ID[muscle];
  const f = fatigue.get(muscle);
  const primary = exercisesFor(muscle, exercises, entries);
  const extras = (['plyometric', 'mobility'] as const)
    .map((kind) => ({ kind, list: exercisesFor(muscle, exercises, entries, kind) }))
    .filter((g) => g.list.length > 0);
  const assisting = exercises.filter((ex) => ex.kind === 'strength' && ex.secondary.includes(muscle));
  const injury = injuries.find((i) => isActive(i) && i.area === muscle);
  const toggle = (id: number) => setOpenId((cur) => (cur === id ? null : id));

  return (
    <Sheet
      title={info.name}
      subtitle={<span className={f?.hoursLeft ? 'status recovering' : 'status ready'}>{recoveryLabel(f)}</span>}
      onClose={onClose}
    >
      {injury && (
        <button className="injury-banner" onClick={() => openInjury(injury.id)}>
          <span>
            <strong>{injuryLabel(injury)} injury</strong> · day {daysOut(injury) + 1}. Keep it pain-free — it’s left out of your plan.
          </span>
          <Icon name="chevron" size={16} />
        </button>
      )}
      <ul className="exercise-list">
        {primary.map((ex) => (
          <ExerciseRow key={ex.id} exercise={ex} open={openId === ex.id} onToggle={() => toggle(ex.id)} />
        ))}
      </ul>
      {extras.map(({ kind, list }) => (
        <section key={kind} className="kind-group">
          <h3 className="section-title">{kind === 'plyometric' ? 'Plyometrics' : 'Mobility'}</h3>
          <ul className="exercise-list">
            {list.map((ex) => (
              <ExerciseRow key={ex.id} exercise={ex} open={openId === ex.id} onToggle={() => toggle(ex.id)} />
            ))}
          </ul>
        </section>
      ))}
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
