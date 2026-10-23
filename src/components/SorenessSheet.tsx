import { useState } from 'react';
import { MUSCLES, type MuscleCategory, type MuscleId } from '../../shared/muscles.ts';
import type { SorenessLevel } from '../../shared/types.ts';
import { useData, useUi } from '../data.tsx';
import { dateKey } from '../lib/stats.ts';
import { Sheet } from './Sheet.tsx';

const GROUPS: [MuscleCategory, string][] = [
  ['push', 'Push'],
  ['pull', 'Pull'],
  ['core', 'Core'],
  ['legs', 'Legs'],
];

const LEVEL_LABEL: Record<SorenessLevel, string> = { 1: 'a bit', 2: 'very' };

export function SorenessSheet({ onClose }: { onClose: () => void }) {
  const { records, put } = useData();
  const { notify } = useUi();
  const id = `sore-${dateKey(new Date())}`;
  const existing = records.soreness.find((s) => s.id === id);
  const [muscles, setMuscles] = useState<Partial<Record<MuscleId, SorenessLevel>>>(existing?.muscles ?? {});

  /** none → a bit sore → very sore → none */
  const cycle = (m: MuscleId) =>
    setMuscles((cur) => {
      const next = { ...cur };
      if (!cur[m]) next[m] = 1;
      else if (cur[m] === 1) next[m] = 2;
      else delete next[m];
      return next;
    });

  function save() {
    put('soreness', { id, recordedAt: new Date().toISOString(), muscles });
    const count = Object.keys(muscles).length;
    notify(count ? `Noted — ${count} sore muscle${count === 1 ? '' : 's'} will rest a little longer` : 'Feeling fresh 💪');
    onClose();
  }

  return (
    <Sheet title="How do you feel?" subtitle="Tap once for a bit sore, twice for very sore" onClose={onClose}>
      {GROUPS.map(([cat, label]) => (
        <div key={cat} className="sore-group">
          <h3 className="section-title">{label}</h3>
          <div className="chips">
            {MUSCLES.filter((m) => m.category === cat).map((m) => {
              const level = muscles[m.id];
              return (
                <button key={m.id} className={`chip sore-${level ?? 0}`} aria-pressed={!!level} onClick={() => cycle(m.id)}>
                  {m.name}
                  {level && <span className="sore-level"> · {LEVEL_LABEL[level]}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button className="btn primary block" onClick={save}>
        {Object.keys(muscles).length ? 'Save check-in' : 'Nothing sore — save'}
      </button>
    </Sheet>
  );
}
