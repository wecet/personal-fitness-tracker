import { useMemo, useState } from 'react';
import { MUSCLE_BY_ID } from '../../shared/muscles.ts';
import type { RoutineItem } from '../../shared/types.ts';
import { useData, useUi } from '../data.tsx';
import { plannedSets } from '../lib/routines.ts';
import { formatSets } from '../lib/stats.ts';
import { newId } from '../lib/store.ts';
import { Icon } from './Icon.tsx';
import { Sheet } from './Sheet.tsx';

export function RoutineEditor({ routineId, onClose }: { routineId?: string; onClose: () => void }) {
  const { routines, exercises, exById, entries, put, remove } = useData();
  const { notify } = useUi();
  const existing = routines.find((r) => r.id === routineId);
  const [name, setName] = useState(existing?.name ?? '');
  const [items, setItems] = useState<RoutineItem[]>(existing?.items ?? []);
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const chosen = new Set(items.map((i) => i.exerciseId));
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return exercises
      .filter((ex) => !chosen.has(ex.id) && (ex.name.toLowerCase().includes(q) || MUSCLE_BY_ID[ex.muscle].name.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [query, exercises, items]);

  function add(exerciseId: number) {
    const ex = exById.get(exerciseId)!;
    setItems((cur) => [...cur, { exerciseId, sets: plannedSets(exerciseId, entries, ex.metric === 'time') }]);
    setQuery('');
  }

  function move(i: number, delta: number) {
    setItems((cur) => {
      const next = [...cur];
      const [it] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, i + delta)), 0, it);
      return next;
    });
  }

  function save() {
    put('routine', { id: existing?.id ?? newId(), name: name.trim(), items, createdAt: existing?.createdAt ?? new Date().toISOString() });
    notify(`Saved ${name.trim()}`);
    onClose();
  }

  function destroy() {
    if (!existing || !confirm(`Delete routine “${existing.name}”?`)) return;
    remove('routine', existing.id);
    onClose();
  }

  return (
    <Sheet title={existing ? 'Edit routine' : 'New routine'} onClose={onClose}>
      <input placeholder="Name, e.g. Push day A" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />

      <ol className="routine-items">
        {items.map((item, i) => {
          const ex = exById.get(item.exerciseId);
          return (
            <li key={item.exerciseId}>
              <span className="routine-index">{i + 1}</span>
              <span className="routine-name">
                <strong>{ex?.name}</strong>
                <span className="muted small">{ex && formatSets(item.sets, ex.metric)}</span>
              </span>
              <button className="icon-btn small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
              <button className="icon-btn small" onClick={() => setItems((cur) => cur.filter((_, j) => j !== i))} aria-label={`Remove ${ex?.name}`}>
                <Icon name="close" size={16} />
              </button>
            </li>
          );
        })}
      </ol>

      <div className="routine-search">
        <input type="search" className="search" placeholder="Add exercise — search name or muscle" value={query} onChange={(e) => setQuery(e.target.value)} />
        {matches.length > 0 && (
          <ul className="search-results">
            {matches.map((ex) => (
              <li key={ex.id}>
                <button onClick={() => add(ex.id)}>
                  <span>{ex.name}</span>
                  <span className="muted small">{MUSCLE_BY_ID[ex.muscle].name}</span>
                  <Icon name="plus" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="muted small">Planned sets start from what you did last time and update each time you finish this routine.</p>
      <button className="btn primary block" disabled={!name.trim() || items.length === 0} onClick={save}>Save routine</button>
      {existing && <button className="btn ghost block" onClick={destroy}>Delete routine</button>}
    </Sheet>
  );
}
