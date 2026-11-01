import { useId, type CSSProperties } from 'react';
import type { MuscleId } from '../../shared/muscles.ts';
import type { RegionGroup, View } from '../lib/regions.ts';
import { BACK, FRONT, HEAD, SILHOUETTE, both, mirror } from './bodyPaths.ts';

/** On-screen height of each view, in px; pattern and label sizes are set against it. */
const HEIGHT = 160;
/** Callout badge radius and the gap between badges and the muscle, in px. */
const BADGE = 9;
const GAP = 14;

/** Regions fill in one after another when the sheet opens. */
const order = (n: number) => ({ '--i': n }) as CSSProperties;

function bounds(paths: string[]) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const d of paths) for (const [, x, y] of d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)) xs.push(Number(x)), ys.push(Number(y));
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** Solid, hatched, cross-hatched, dotted: each region reads apart even without colour. */
function Shades({ id, u }: { id: string; u: number }) {
  const s = 4.5 * u;
  const line = { stroke: 'var(--coral)', strokeWidth: 1.3 * u };
  return (
    <>
      <pattern id={`${id}-1`} width={s} height={s} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={s} height={s} fill="var(--coral)" fillOpacity=".22" />
        <line x1="0" y1="0" x2="0" y2={s} {...line} />
      </pattern>
      <pattern id={`${id}-2`} width={s} height={s} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={s} height={s} fill="var(--coral)" fillOpacity=".12" />
        <line x1="0" y1="0" x2="0" y2={s} {...line} strokeOpacity=".8" />
        <line x1="0" y1="0" x2={s} y2="0" {...line} strokeOpacity=".8" />
      </pattern>
      <pattern id={`${id}-3`} width={s} height={s} patternUnits="userSpaceOnUse">
        <rect width={s} height={s} fill="var(--coral)" fillOpacity=".1" />
        <circle cx={s / 2} cy={s / 2} r={0.9 * u} fill="var(--coral)" />
      </pattern>
    </>
  );
}

function DiagramView({ muscle, view, groups, onPick }: { muscle: MuscleId; view: View; groups: RegionGroup[]; onPick: (id: string) => void }) {
  const id = useId().replace(/:/g, '');
  const half = (view === 'front' ? FRONT : BACK)[muscle] ?? [];
  const box = bounds(half);
  // Muscles that meet at the midline are drawn whole; limbs show one side.
  const whole = box.maxX >= 95;
  const paths = whole ? half.flatMap(both) : half;
  const maxX = whole ? 200 - box.minX : box.maxX;
  const pad = Math.max(5, 0.1 * (box.maxY - box.minY));
  const h = box.maxY - box.minY + 2 * pad;
  const u = h / HEIGHT;
  // Badges sit in a column left of the muscle, like callouts in an anatomy plate.
  const column = box.minX - (GAP + BADGE) * u;
  const left = column - (BADGE + 4) * u;
  const right = Math.max(maxX + pad, left + 0.55 * h);
  const vb = { x: left, y: box.minY - pad, w: right - left, h };
  const shade = (i: number) => (i === 0 ? 'var(--coral)' : `url(#${id}-${Math.min(i, 3)})`);
  const areas = groups.flatMap((g, i) => g.region.areas.filter((a) => a.view === view).map((a) => ({ ...a, group: g, i })));
  // Badges read 1, 2, 3 down the column, level with their region where there's room.
  let floor = -Infinity;
  const callouts = [...areas].sort((a, b) => a.group.number - b.group.number).map((a) => {
    const y = Math.max(a.label[1], floor + (2 * BADGE + 4) * u);
    floor = y;
    return { ...a, y };
  });

  return (
    <figure className="diagram-view">
      <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} height={HEIGHT} style={{ aspectRatio: `${vb.w} / ${vb.h}` }} aria-hidden="true">
        <defs>
          <clipPath id={`${id}-m`}>{paths.map((d, k) => <path key={k} d={d} />)}</clipPath>
          <radialGradient id={`${id}-fade`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.3" stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </radialGradient>
          <mask id={`${id}-vignette`} maskUnits="userSpaceOnUse" x={vb.x} y={vb.y} width={vb.w} height={vb.h}>
            <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={`url(#${id}-fade)`} />
          </mask>
          <Shades id={id} u={u} />
        </defs>
        <g className="diagram-body" mask={`url(#${id}-vignette)`}>
          {both(SILHOUETTE).map((d, k) => <path key={k} d={d} />)}
          {both(HEAD).map((d, k) => <path key={`h${k}`} d={d} />)}
        </g>
        <g clipPath={`url(#${id}-m)`}>
          <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="var(--muscle-lo)" />
          {areas.map(({ points, group, i }) =>
            (whole ? [points, mirror(points)] : [points]).map((p, k) => (
              <polygon key={`${group.region.id}-${k}`} className="diagram-region" style={order(i)} points={p} fill={shade(i)} fillOpacity={i === 0 ? 0.85 : 1}
                stroke="var(--surface)" strokeWidth={1.6 * u} onClick={() => onPick(group.region.id)} />
            )),
          )}
        </g>
        {paths.map((d, k) => <path key={k} d={d} fill="none" stroke="var(--skin-edge)" strokeWidth={u} />)}
        {callouts.map(({ label: [x, ay], y, group }) => (
          <g key={group.region.id} className="diagram-label" style={order(group.number - 1)} onClick={() => onPick(group.region.id)}>
            <path className="diagram-leader" pathLength={1} d={`M${column + BADGE * u},${y} L${column + (BADGE + 4) * u},${y} L${x},${ay}`} strokeWidth={u} />
            <circle className="diagram-anchor" cx={x} cy={ay} r={1.8 * u} />
            <circle cx={column} cy={y} r={BADGE * u} strokeWidth={1.4 * u} />
            <text x={column} y={y} fontSize={11 * u} dy=".35em">{group.number}</text>
          </g>
        ))}
      </svg>
      <figcaption className="muted small">{view === 'front' ? 'Front' : 'Back'}</figcaption>
    </figure>
  );
}

/** The muscle cut into its numbered regions, matching the exercise groups below it. */
export function MuscleDiagram({ muscle, groups, onPick }: { muscle: MuscleId; groups: RegionGroup[]; onPick: (regionId: string) => void }) {
  const views = (['front', 'back'] as const).filter((v) => groups.some((g) => g.region.areas.some((a) => a.view === v)));
  return (
    <div className="muscle-diagram" role="img" aria-label={groups.map((g) => `${g.number}: ${g.region.name}`).join(', ')}>
      {views.map((v) => <DiagramView key={v} muscle={muscle} view={v} groups={groups} onPick={onPick} />)}
    </div>
  );
}
