import { useRef, useState } from 'react';
import { useData } from '../data.tsx';
import { useSession } from '../session.tsx';
import { ExerciseLogger } from './ExerciseLogger.tsx';
import { Sheet } from './Sheet.tsx';

/**
 * Two exercises done back to back: a set of A, a set of B, then rest. The rest
 * timer starts only once the same set is ticked off on both.
 */
export function SupersetSheet({ exerciseIds, onClose }: { exerciseIds: number[]; onClose: () => void }) {
  const { exById, pbs } = useData();
  const { startRest } = useSession();
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const ticked = useRef(new Map<number, Set<number>>());
  const exercises = exerciseIds.map((id) => exById.get(id)).filter((ex) => ex !== undefined);

  const setDone = (exerciseId: number, index: number) => {
    const mine = ticked.current.get(exerciseId) ?? new Set();
    mine.add(index);
    ticked.current.set(exerciseId, mine);
    const others = exercises.filter((ex) => ex.id !== exerciseId && !saved.has(ex.id));
    if (others.every((ex) => ticked.current.get(ex.id)?.has(index))) startRest();
  };

  const onSaved = (exerciseId: number) => {
    const next = new Set(saved).add(exerciseId);
    setSaved(next);
    if (exercises.every((ex) => next.has(ex.id))) onClose();
  };

  return (
    <Sheet title="Superset" subtitle={`${exercises.map((ex) => ex.name).join(' + ')} · rest after both`} onClose={onClose}>
      {exercises.map((ex, i) => (
        <section key={ex.id} className={`superset-part ${saved.has(ex.id) ? 'saved' : ''}`}>
          <h3>
            <span className="ss-letter" aria-hidden="true">{saved.has(ex.id) ? '✓' : String.fromCharCode(65 + i)}</span>
            {ex.name}
          </h3>
          {!saved.has(ex.id) && (
            <ExerciseLogger exercise={ex} pb={pbs.get(ex.id)} onSaved={() => onSaved(ex.id)} onSetDone={(index) => setDone(ex.id, index)} />
          )}
        </section>
      ))}
    </Sheet>
  );
}
