import { useState } from 'react';
import { ALL_PLATES, BARS, loadBar } from '../lib/plates.ts';
import { formatKg } from '../lib/stats.ts';
import { Sheet } from './Sheet.tsx';

const PREFS_KEY = 'ember-plates';

function loadPrefs(): { bar: number; plates: number[] } {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null');
    if (p && BARS.includes(p.bar) && Array.isArray(p.plates)) return p;
  } catch {}
  return { bar: 20, plates: ALL_PLATES };
}

/** Plate height (px) in the drawing, by weight. */
const plateHeight = (kg: number) => (kg >= 20 ? 92 : kg >= 15 ? 80 : kg >= 10 ? 66 : kg >= 5 ? 50 : kg >= 2.5 ? 40 : 32);

export function PlateSheet({ initialKg, onClose }: { initialKg?: number; onClose: () => void }) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [target, setTarget] = useState(initialKg ? String(initialKg) : '');
  const update = (next: typeof prefs) => {
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {}
  };
  const kg = Number(target.replace(',', '.'));
  const result = target && Number.isFinite(kg) ? loadBar(kg, prefs.bar, prefs.plates) : null;

  return (
    <Sheet title="Plate calculator" subtitle="Plates per side" onClose={onClose}>
      <label className="field">
        <span className="field-head"><span>Target weight (kg)</span></span>
        <input inputMode="decimal" placeholder="e.g. 100" value={target} onChange={(e) => setTarget(e.target.value)} autoFocus={!initialKg} />
      </label>

      <div className="field">
        <span className="field-head"><span>Bar</span></span>
        <div className="day-picker cols-4" role="radiogroup" aria-label="Bar weight">
          {BARS.map((b) => (
            <button key={b} type="button" role="radio" aria-checked={prefs.bar === b} className={prefs.bar === b ? 'active' : ''} onClick={() => update({ ...prefs, bar: b })}>
              {b ? `${b} kg` : 'None'}
            </button>
          ))}
        </div>
      </div>

      {result ? (
        <div className="plates-result">
          <svg viewBox="0 0 320 110" className="barbell" role="img" aria-label={`Each side: ${result.perSide.join(', ') || 'no plates'} kg`}>
            <rect x="0" y="51" width="320" height="8" rx="2" className="bar-shaft" />
            <rect x="108" y="40" width="10" height="30" rx="2" className="bar-collar" />
            {(() => {
              let x = 120;
              return result.perSide.map((p, i) => {
                const h = plateHeight(p);
                const w = p >= 10 ? 14 : 10;
                const el = (
                  <g key={i}>
                    <rect x={x} y={55 - h / 2} width={w} height={h} rx="3" className={`plate plate-${String(p).replace('.', '_')}`} />
                  </g>
                );
                x += w + 2;
                return el;
              });
            })()}
          </svg>
          <div className="plate-list">
            {result.perSide.length === 0 ? (
              <span className="muted">Just the bar.</span>
            ) : (
              Object.entries(result.perSide.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p]: (acc[p] ?? 0) + 1 }), {}))
                .sort((a, b) => Number(b[0]) - Number(a[0]))
                .map(([p, n]) => <span key={p} className="chip"><span className={`swatch plate-${p.replace('.', '_')}`} />{n} × {p} kg</span>)
            )}
          </div>
          {!result.exact && <p className="warning">Can’t make {formatKg(kg)} exactly with these plates — closest is {formatKg(result.total)}.</p>}
        </div>
      ) : target ? (
        <p className="muted">That’s lighter than the bar.</p>
      ) : null}

      <div className="field">
        <span className="field-head"><span>Plates you have</span></span>
        <div className="chips">
          {ALL_PLATES.map((p) => {
            const on = prefs.plates.includes(p);
            return (
              <button key={p} className={`chip ${on ? 'coral' : ''}`} aria-pressed={on}
                onClick={() => update({ ...prefs, plates: on ? prefs.plates.filter((x) => x !== p) : [...prefs.plates, p] })}>
                {p} kg
              </button>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
