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

  /** Moving or removing an exercise breaks up any superset it was part of. */
  const unpair = (list: RoutineItem[], i: number) =>
    list.map((it, j) => (j === i || j === i - 1 ? { ...it, supersetNext: undefined } : it));

  function move(i: number, delta: number) {
    setItems((cur) => {
      const next = unpair(cur, i);
      const [it] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, i + delta)), 0, it);
      return next;
    });
  }

  const togglePair = (i: number) =>
    setItems((cur) => cur.map((it, j) => (j === i ? { ...it, supersetNext: it.supersetNext ? undefined : true } : it)));

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
          const pairedAbove = !!items[i - 1]?.supersetNext;
          const canPair = i < items.length - 1 && !pairedAbove && !items[i + 1]?.supersetNext;
          return (
            <li key={item.exerciseId} className={`${item.supersetNext ? 'pair-top' : ''} ${pairedAbove ? 'pair-bottom' : ''}`}>
              <span className="routine-index">{i + 1}</span>
              <span className="routine-name">
                <strong>{ex?.name}</strong>
                <span className="muted small">{ex && formatSets(item.sets, ex.metric)}</span>
              </span>
              {(item.supersetNext || canPair) && (
                <button className={`icon-btn small pair-btn ${item.supersetNext ? 'on' : ''}`} onClick={() => togglePair(i)} aria-pressed={!!item.supersetNext}
                  aria-label={item.supersetNext ? `Unpair ${ex?.name} from the next exercise` : `Superset ${ex?.name} with the next exercise`}>
                  <Icon name="link" size={16} />
                </button>
              )}
              <button className="icon-btn small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
              <button className="icon-btn small" onClick={() => setItems((cur) => unpair(cur, i).filter((_, j) => j !== i))} aria-label={`Remove ${ex?.name}`}>
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

      {items.length > 1 && <p className="muted small">Tap <Icon name="link" size={13} /> to superset an exercise with the next one.</p>}
      <button className="btn primary block" disabled={!name.trim() || items.length === 0} onClick={save}>Save routine</button>
      {existing && <button className="btn ghost block" onClick={destroy}>Delete routine</button>}
    </Sheet>
  );
}
