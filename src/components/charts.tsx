import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

/*
 * Minimal SVG charts. Specs: 2px lines, ~10% area wash, ≥8px markers with a 2px
 * surface ring, ≤24px columns with 4px rounded caps and 2px surface gaps,
 * hairline recessive grid, one y-axis, crosshair/per-bar tooltips, and a table view.
 */

const PAD = { top: 16, right: 44, bottom: 22, left: 40 };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** ~4 round tick values covering [min, max]. */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) ticks.push(Number(v.toFixed(6)));
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

export const compact = (n: number) =>
  Math.abs(n) >= 1000 ? `${Number((n / 1000).toFixed(n >= 10_000 ? 0 : 1))}K` : String(Number(n.toFixed(1)));

function Tooltip({ x, width, children }: { x: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x, 70), width - 70);
  return (
    <div className="chart-tooltip" style={{ left }}>
      {children}
    </div>
  );
}

function TableView({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="chart-table">
      <summary>View as table</summary>
      <table>
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </details>
  );
}

// ---------- line ----------

export interface LinePoint {
  x: number;
  y: number;
  /** Drawn as a marker (e.g. a PB). */
  mark?: boolean;
}

export function LineChart({
  points,
  label,
  formatY,
  formatX,
  color = 'var(--chart-1)',
  height = 180,
  band,
  zeroBased = false,
  area: showArea = true,
  extra,
}: {
  points: LinePoint[];
  label: string;
  formatY: (n: number) => string;
  formatX: (x: number) => string;
  color?: string;
  height?: number;
  /** A shaded target range, e.g. the ACWR sweet spot. */
  band?: { from: number; to: number; label: string };
  zeroBased?: boolean;
  /** Draw the ~10% wash under the line (off when a band already shades the plot). */
  area?: boolean;
  /** Extra tooltip line per point. */
  extra?: (p: LinePoint) => string | null;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  if (points.length === 0) return <p className="muted small">Nothing to chart yet.</p>;

  const ys = points.map((p) => p.y).concat(band ? [band.from, band.to] : []);
  const ticks = niceTicks(zeroBased ? 0 : Math.min(...ys) * 0.97, Math.max(...ys) * 1.02);
  const [y0, y1] = [ticks[0], ticks[ticks.length - 1]];
  const [x0, x1] = [points[0].x, points[points.length - 1].x];
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const sx = (x: number) => PAD.left + (x1 === x0 ? innerW / 2 : ((x - x0) / (x1 - x0)) * innerW);
  const sy = (y: number) => PAD.top + innerH - ((y - y0) / (y1 - y0)) * innerH;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
  const area = `${line}L${sx(x1)},${sy(y0)}L${sx(x0)},${sy(y0)}Z`;
  const last = points[points.length - 1];
  const xTicks = points.length > 1 ? [0, 0.5, 1].map((f) => x0 + (x1 - x0) * f) : [x0];

  const nearest = (clientX: number, el: Element) => {
    const px = clientX - el.getBoundingClientRect().left;
    let best = 0;
    points.forEach((p, i) => Math.abs(sx(p.x) - px) < Math.abs(sx(points[best].x) - px) && (best = i));
    return best;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1));
    if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? points.length) - 1));
  };
  const a = active != null ? points[active] : null;

  return (
    <div className="chart" ref={ref}>
      {band && (
        <div className="chart-legend">
          <span><i className="band-swatch" />{band.label}</span>
        </div>
      )}
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        onPointerMove={(e: PointerEvent<SVGSVGElement>) => setActive(nearest(e.clientX, e.currentTarget))}
        onPointerLeave={() => setActive(null)}
      >
        {band && (
          <rect x={PAD.left} width={innerW} y={sy(band.to)} height={sy(band.from) - sy(band.to)} className="chart-band" />
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={sy(t)} y2={sy(t)} className="chart-grid" />
            <text x={PAD.left - 6} y={sy(t) + 3} textAnchor="end" className="chart-axis">{compact(t)}</text>
          </g>
        ))}
        {xTicks.map((x, i) => (
          <text key={i} x={sx(x)} y={height - 6} textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'} className="chart-axis">
            {formatX(x)}
          </text>
        ))}
        {showArea && <path d={area} fill={color} opacity={0.1} />}
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => p.mark && <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={4} fill={color} className="chart-dot" />)}
        <circle cx={sx(last.x)} cy={sy(last.y)} r={4} fill={color} className="chart-dot" />
        <text x={sx(last.x) + 8} y={sy(last.y) + 4} className="chart-value">{formatY(last.y)}</text>
        {a && (
          <g pointerEvents="none">
            <line x1={sx(a.x)} x2={sx(a.x)} y1={PAD.top} y2={PAD.top + innerH} className="chart-crosshair" />
            <circle cx={sx(a.x)} cy={sy(a.y)} r={5} fill={color} className="chart-dot" />
          </g>
        )}
      </svg>
      {a && (
        <Tooltip x={sx(a.x)} width={width}>
          <strong>{formatY(a.y)}</strong>
          <span>{formatX(a.x)}</span>
          {extra?.(a) && <span>{extra(a)}</span>}
        </Tooltip>
      )}
      <TableView head={['Date', 'Value']} rows={[...points].reverse().map((p) => [formatX(p.x), formatY(p.y) + (extra?.(p) ? ` · ${extra(p)}` : '')])} />
    </div>
  );
}

// ---------- stacked columns ----------

export interface Series {
  name: string;
  color: string;
}

export function StackedColumns({
  bars,
  series,
  label,
  formatY,
  height = 190,
}: {
  bars: { label: string; title: string; values: number[] }[];
  series: Series[];
  label: string;
  formatY: (n: number) => string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const totals = bars.map((b) => b.values.reduce((s, v) => s + v, 0));
  const ticks = niceTicks(0, Math.max(1, ...totals), 3);
  const yMax = ticks[ticks.length - 1];
  const innerW = width - PAD.left - 12;
  const innerH = height - PAD.top - PAD.bottom;
  const slot = innerW / bars.length;
  const barW = Math.min(24, slot - 4);
  const sy = (v: number) => (v / yMax) * innerH;
  const base = PAD.top + innerH;
  const a = active != null ? bars[active] : null;
  // Thin out x labels so neighbours (especially the last one) never collide.
  const labelStep = Math.max(1, Math.ceil(bars.length / Math.max(2, Math.floor(innerW / 64))));

  return (
    <div className="chart" ref={ref}>
      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>
          ))}
        </div>
      )}
      <svg width={width} height={height} role="img" aria-label={label} onPointerLeave={() => setActive(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - 12} y1={base - sy(t)} y2={base - sy(t)} className="chart-grid" />
            <text x={PAD.left - 6} y={base - sy(t) + 3} textAnchor="end" className="chart-axis">{compact(t)}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const top = b.values.reduce((acc, v, j) => (v > 0 ? j : acc), -1);
          let y = base;
          return (
            <g
              key={i}
              tabIndex={0}
              aria-label={`${b.title}: ${b.values.map((v, j) => `${series[j].name} ${formatY(v)}`).join(', ')}`}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className={active === i ? 'chart-bar active' : 'chart-bar'}
            >
              <rect x={cx - slot / 2} width={slot} y={PAD.top} height={innerH} fill="transparent" />
              {b.values.map((v, j) => {
                if (v <= 0) return null;
                const bottom = y;
                y -= sy(v);
                // A 2px surface gap separates each segment from the one above; only the top one is rounded.
                const yTop = j === top ? y : y + 2;
                const h = Math.max(1, bottom - yTop);
                const r = j === top ? Math.min(4, h) : 0;
                const d = `M${cx - barW / 2},${bottom}V${yTop + r}q0,-${r} ${r},-${r}H${cx + barW / 2 - r}q${r},0 ${r},${r}V${bottom}Z`;
                return <path key={j} d={d} fill={series[j].color} />;
              })}
              {(i === bars.length - 1 || (i % labelStep === 0 && bars.length - 1 - i >= labelStep)) && (
                <text x={cx} y={height - 6} textAnchor="middle" className="chart-axis">{b.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      {a && (
        <Tooltip x={PAD.left + slot * active! + slot / 2} width={width}>
          <strong>{formatY(totals[active!])}</strong>
          <span>{a.title}</span>
          {series.map((s, j) => (
            <span key={s.name} className="tooltip-row"><i style={{ background: s.color }} />{s.name} {formatY(a.values[j])}</span>
          ))}
        </Tooltip>
      )}
      <TableView head={['Period', ...series.map((s) => s.name), 'Total']} rows={[...bars].reverse().map((b, i) => [b.title, ...b.values.map(formatY), formatY(totals[bars.length - 1 - i])])} />
    </div>
  );
}
