import { useState } from 'react';
import { MUSCLE_BY_ID } from '../../shared/muscles.ts';
import type { ExerciseKind } from '../../shared/types.ts';
import { useData } from '../data.tsx';
import { byUse } from '../lib/stats.ts';
import { ExerciseRow } from './MuscleSheet.tsx';
import { Sheet } from './Sheet.tsx';

const COPY: Record<Exclude<ExerciseKind, 'strength'>, { title: string; subtitle: string }> = {
  plyometric: { title: 'Plyometrics', subtitle: 'Log reps as ground contacts (or throws). 80–140 contacts makes a full session.' },
  mobility: { title: 'Mobility', subtitle: 'Stretching and activation. Logged for consistency; adds no fatigue.' },
};

/** Every plyometric or mobility exercise in one place, since they rarely belong to a single muscle. */
export function KindSheet({ kind, onClose }: { kind: Exclude<ExerciseKind, 'strength'>; onClose: () => void }) {
  const { exercises, entries } = useData();
  const [openId, setOpenId] = useState<number | null>(null);
  const list = byUse(exercises.filter((ex) => ex.kind === kind), entries);

  return (
    <Sheet title={COPY[kind].title} subtitle={COPY[kind].subtitle} onClose={onClose}>
      <ul className="exercise-list">
        {list.map((ex) => (
          <ExerciseRow key={ex.id} exercise={ex} detail={MUSCLE_BY_ID[ex.muscle].name}
            open={openId === ex.id} onToggle={() => setOpenId((cur) => (cur === ex.id ? null : ex.id))} />
        ))}
      </ul>
    </Sheet>
  );
}
