import { useState, type FormEvent, type ReactNode } from 'react';
import { MUSCLE_BY_ID, type MuscleId } from '../../shared/muscles.ts';
import { EXERCISE_KINDS, EXERCISE_METRICS, type Exercise, type ExerciseKind, type ExerciseMetric } from '../../shared/types.ts';
import { useData, useUi } from '../data.tsx';
import { daysOut, injuryLabel, isActive, returnStages, stagesCleared } from '../lib/injuries.ts';
import { groupByRegion } from '../lib/regions.ts';
import { averageTrend, formatPct, progressSeries, trend, TREND_DAYS } from '../lib/trends.ts';
import { exercisesFor, formatPb, formatSets, recoveryLabel } from '../lib/stats.ts';
import { ExerciseLogger } from './ExerciseLogger.tsx';
import { Icon, type IconName } from './Icon.tsx';
import { MuscleDiagram } from './MuscleDiagram.tsx';
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

/** A collapsible group: just a heading row until opened. */
function Fold({ id, open, onToggle, badge, title, hint, aside, children }: {
  id: string;
  open: boolean;
  onToggle: () => void;
  badge: ReactNode;
  title: string;
  hint: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={`fold-${id}`} className={`fold ${open ? 'open' : ''}`}>
      <h3>
        <button className="fold-head" aria-expanded={open} aria-controls={`fold-body-${id}`} onClick={onToggle}>
          {badge}
          <span className="fold-title">
            {title}
            <span className="muted small">{hint}</span>
          </span>
          {aside}
          <span className="chevron" aria-hidden="true"><Icon name="chevron" size={18} /></span>
        </button>
      </h3>
      <div className="fold-body" id={`fold-body-${id}`} inert={!open}>
        <div>{children}</div>
      </div>
    </section>
  );
}

const IconBadge = ({ name }: { name: IconName }) => <span className="region-number icon" aria-hidden="true"><Icon name={name} size={16} /></span>;
const count = (n: number) => `${n} exercise${n === 1 ? '' : 's'}`;

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
  const { exercises, entries, fatigue, injuries, now, exById } = useData();
  const { openInjury } = useUi();
  const [openId, setOpenId] = useState<number | null>(exerciseId ?? null);
  const info = MUSCLE_BY_ID[muscle];
  const f = fatigue.get(muscle);
  const { groups, other } = groupByRegion(muscle, exercisesFor(muscle, exercises, entries));
  const extras = (['plyometric', 'mobility'] as const)
    .map((kind) => ({ kind, list: exercisesFor(muscle, exercises, entries, kind) }))
    .filter((g) => g.list.length > 0);
  const assisting = exercises.filter((ex) => ex.kind === 'strength' && ex.secondary.includes(muscle));
  const injury = injuries.find((i) => isActive(i) && i.area === muscle);
  /** Average strength change across a region's exercises lately, so you can see which part is moving. */
  const regionTrend = (list: Exercise[]) =>
    averageTrend(list.map((ex) => trend(progressSeries(ex, entries.filter((e) => e.exerciseId === ex.id)).points, now)));
  const toggle = (id: number) => setOpenId((cur) => (cur === id ? null : id));
  const rows = (list: Exercise[]) => (
    <ul className="exercise-list">
      {list.map((ex) => <ExerciseRow key={ex.id} exercise={ex} open={openId === ex.id} onToggle={() => toggle(ex.id)} />)}
    </ul>
  );

  // Every group starts folded except one: the exercise you came for, else the one you last trained here.
  const folds: { id: string; list: Exercise[] }[] = [
    ...groups.map((g) => ({ id: g.region.id, list: g.exercises })),
    { id: 'other', list: other },
    ...extras.map((g) => ({ id: g.kind, list: g.list })),
    { id: 'assisting', list: assisting },
  ];
  const foldOf = (exId: number | undefined) => folds.find((f) => f.list.some((ex) => ex.id === exId))?.id ?? null;
  const lastHere = entries.findLast((e) => exById.get(e.exerciseId)?.muscle === muscle)?.exerciseId;
  const [openFold, setOpenFold] = useState<string | null>(() => foldOf(exerciseId) ?? foldOf(lastHere));
  const fold = (id: string) => ({ id, open: openFold === id, onToggle: () => setOpenFold((cur) => (cur === id ? null : id)) });

  /** Tapping a number on the diagram opens that region and brings it into view. */
  const pick = (regionId: string) => {
    setOpenFold(regionId);
    const group = document.getElementById(`fold-${regionId}`);
    if (!group) return;
    group.scrollIntoView({ behavior: 'smooth', block: 'start' });
    group.classList.remove('flash');
    void group.offsetWidth; // restart the animation on repeat taps
    group.classList.add('flash');
  };

  return (
    <Sheet
      title={info.name}
      subtitle={<span className={f?.hoursLeft ? 'status recovering' : 'status ready'}>{recoveryLabel(f)}</span>}
      onClose={onClose}
    >
      {injury && (
        <button className="injury-banner" onClick={() => openInjury(injury.id)}>
          <span>
            <strong>{injuryLabel(injury)} injury</strong> · day {daysOut(injury) + 1} · return to play {stagesCleared(injury)}/{returnStages(injury).length}.
            Keep it pain-free — it’s left out of your plan.
          </span>
          <Icon name="chevron" size={16} />
        </button>
      )}
      <MuscleDiagram muscle={muscle} groups={groups} onPick={pick} />
      <div className="folds">
        {groups.map(({ region, number, exercises: list }) => {
          const pct = regionTrend(list);
          return (
            <Fold key={region.id} {...fold(region.id)} badge={<span className="region-number">{number}</span>}
              title={region.name} hint={`${region.hint} · ${count(list.length)}`}
              aside={pct != null && (
                <span className={`region-trend trend ${pct > 0.005 ? 'up' : pct < -0.005 ? 'down' : ''}`} title={`Strength change over the last ${TREND_DAYS / 7} weeks`}>
                  {formatPct(pct)}<span className="muted small">{TREND_DAYS / 7} wk</span>
                </span>
              )}>
              {list.length > 0 ? rows(list) : <p className="muted small fold-empty">No exercises here yet — add your own below.</p>}
            </Fold>
          );
        })}
        {other.length > 0 && (
          <Fold {...fold('other')} badge={<IconBadge name="list" />} title="Other" hint={count(other.length)}>{rows(other)}</Fold>
        )}
        {extras.map(({ kind, list }) => (
          <Fold key={kind} {...fold(kind)} badge={<IconBadge name={kind === 'plyometric' ? 'jump' : 'stretch'} />}
            title={kind === 'plyometric' ? 'Plyometrics' : 'Mobility'} hint={count(list.length)}>
            {rows(list)}
          </Fold>
        ))}
        {assisting.length > 0 && (
          <Fold {...fold('assisting')} badge={<IconBadge name="plus" />} title={`Also works ${info.name.toLowerCase()}`}
            hint={`${count(assisting.length)} where it helps`}>
            {rows(assisting)}
          </Fold>
        )}
      </div>
      <AddExercise muscle={muscle} />
    </Sheet>
  );
}
