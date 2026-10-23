import { useState } from 'react';
import { MUSCLES } from '../../shared/muscles.ts';
import { useData, useUi } from '../data.tsx';
import { formatPb } from '../lib/stats.ts';

export function RecordsPage() {
  const { exercises, pbs } = useData();
  const { openMuscle } = useUi();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const groups = MUSCLES.map((m) => ({
    muscle: m,
    items: exercises.filter((ex) => ex.muscle === m.id && pbs.has(ex.id) && ex.name.toLowerCase().includes(q)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="page">
      <input className="search" type="search" placeholder="Search exercises" value={query} onChange={(e) => setQuery(e.target.value)} />
      {groups.length === 0 && (
        <p className="muted empty">{pbs.size === 0 ? 'Log your first workout from the body map to start tracking PBs.' : 'No matches.'}</p>
      )}
      {groups.map(({ muscle, items }) => (
        <section className="card" key={muscle.id}>
          <h3>{muscle.name}</h3>
          <ul className="records">
            {items.map((ex) => {
              const pb = pbs.get(ex.id)!;
              return (
                <li key={ex.id}>
                  <button onClick={() => openMuscle(ex.muscle, ex.id)}>
                    <span>{ex.name}</span>
                    <span className="muted small">{new Date(pb.performedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span className="pb-badge">{formatPb(pb, ex.metric)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
