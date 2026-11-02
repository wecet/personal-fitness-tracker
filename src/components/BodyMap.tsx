import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { haptic } from '../lib/haptics.ts';
import { MUSCLE_BY_ID, type MuscleId } from '../../shared/muscles.ts';
import type { BodySide } from '../lib/injuries.ts';
import { BACK, BACK_DETAILS, both, EAR, FRONT, FRONT_DETAILS, HEAD, SILHOUETTE, VIEWBOX } from './bodyPaths.ts';

export type Side = 'front' | 'back';

export type OverlayTone = 'fatigue' | 'volume' | 'neglect';

const MAX_TILT = 9;
/** Hold a muscle this long to peek at it instead of opening it. */
const PEEK_MS = 420;
/** Long enough for the tap ripple to register before the sheet covers it. */
const OPEN_DELAY_MS = 140;
/** How long the old overlay lingers while the new mode fades in. */
const CROSSFADE_MS = 600;

/** The y of a path's starting point, for ordering muscles head to toe. */
const startY = (d: string) => Number(/^M[\d.]+,([\d.]+)/.exec(d)?.[1] ?? 0);

/** Both halves of every shape, computed once, with each muscle's rank from the top. */
function figure(shapes: Partial<Record<MuscleId, string[]>>, details: string[]) {
  const muscles = Object.entries(shapes).map(([m, ds]) => [m as MuscleId, ds!.flatMap(both)] as const);
  const order = [...muscles].sort((a, b) => startY(a[1][0]) - startY(b[1][0])).map(([m]) => m);
  return { muscles, details, rank: new Map(order.map((m, i) => [m, i])) };
}
const FIGURES = {
  front: figure(FRONT, ['M100,80 L100,216', ...FRONT_DETAILS.flatMap(both)]),
  back: figure(BACK, ['M100,60 L100,212', ...BACK_DETAILS.flatMap(both)]),
};
const rankStyle = (i: number) => ({ '--i': i }) as CSSProperties;

/** One mode's colouring. Switching mode keeps the old layer briefly so they cross-fade. */
interface Layer {
  tone: OverlayTone;
  overlay: Map<MuscleId, number>;
  leaving?: boolean;
}
const [BODY_L, BODY_R] = both(SILHOUETTE);
const [HEAD_L, HEAD_R] = both(HEAD);
const EARS = both(EAR);

/**
 * Paths alternate viewer-left half, mirrored half (see both()). Facing you, the
 * viewer's left is the body's right; from behind it's the body's left.
 */
const bodySide = (side: Side, index: number): BodySide => ((index % 2 === 0) === (side === 'front') ? 'right' : 'left');

interface FigureProps {
  side: Side;
  layers: Layer[];
  suggested: MuscleId[];
  injured: Map<MuscleId, Set<BodySide>>;
  hover: MuscleId | null;
  onHover: (m: MuscleId | null) => void;
  onSelect: (m: MuscleId) => void;
}

function Figure({ side, layers, suggested, injured, hover, onHover, onSelect }: FigureProps) {
  const { muscles, details, rank } = FIGURES[side];
  const id = (name: string) => `${side}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  return (
    <svg viewBox={VIEWBOX} className="figure" aria-label={`${side} view`}>
      <defs>
        {/* Cylinder shading: each half is dark at its outer edge and lit toward the centre line. */}
        <linearGradient id={id('skin-l')} x1="0" x2="1">
          <stop offset="0" style={{ stopColor: 'var(--skin-edge)' }} />
          <stop offset="1" style={{ stopColor: 'var(--skin-core)' }} />
        </linearGradient>
        <linearGradient id={id('skin-r')} x1="1" x2="0">
          <stop offset="0" style={{ stopColor: 'var(--skin-edge)' }} />
          <stop offset="1" style={{ stopColor: 'var(--skin-core)' }} />
        </linearGradient>
        {/* One key light from the upper left, shared by every muscle. */}
        <linearGradient id={id('muscle')} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--muscle-hi)' }} />
          <stop offset="0.5" style={{ stopColor: 'var(--muscle-mid)' }} />
          <stop offset="1" style={{ stopColor: 'var(--muscle-lo)' }} />
        </linearGradient>
        <radialGradient id={id('sheen')} cx="0.32" cy="0.26" r="0.55">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        {/* Ambient occlusion: each muscle darkens toward its edges, so it reads as rounded. */}
        <radialGradient id={id('occlusion')} cx="0.45" cy="0.4" r="0.7">
          <stop offset="0.5" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.5" />
        </radialGradient>
        <radialGradient id={id('key')} gradientUnits="userSpaceOnUse" cx="60" cy="70" r="260">
          <stop offset="0" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        {/* Heat: hot core, deep red edges. */}
        <radialGradient id={id('heat')} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#ffb46b" />
          <stop offset="0.45" stopColor="#ff5634" />
          <stop offset="1" stopColor="#c41d2a" />
        </radialGradient>
        <radialGradient id={id('head')} cx="0.4" cy="0.32" r="0.75">
          <stop offset="0" style={{ stopColor: 'var(--skin-core)' }} />
          <stop offset="1" style={{ stopColor: 'var(--skin-edge)' }} />
        </radialGradient>
        {/* The halves meet at x = 100; keep the rim light off that seam. */}
        <mask id={id('no-seam')} maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="410">
          <rect width="200" height="410" fill="#fff" />
          <rect x="98.8" width="2.4" height="410" fill="#000" />
        </mask>
        <radialGradient id={id('ground')}>
          <stop offset="0" stopColor="#000" stopOpacity="0.6" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <filter id={id('lift')} x="-20%" y="-10%" width="140%" height="120%">
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#000" floodOpacity="0.5" />
        </filter>
        {/* Muscles sit slightly proud of the body. */}
        <filter id={id('raise')} x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0.6" dy="1.2" stdDeviation="0.8" floodColor="#000" floodOpacity="0.6" />
        </filter>
        <filter id={id('glow')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse cx="100" cy="404" rx="74" ry="10" fill={url('ground')} />
      <ellipse cx="100" cy="401" rx="44" ry="4.5" className="floor-ring" />

      <g filter={url('lift')}>
        <path d={BODY_L} fill={url('skin-l')} />
        <path d={BODY_R} fill={url('skin-r')} />
        <path d={`${HEAD_L} ${HEAD_R}`} fill={url('head')} />
        {EARS.map((d, i) => <path key={i} d={d} fill="var(--skin-edge)" />)}
      </g>
      <g className="rim" mask={url('no-seam')}>
        <path d={BODY_L} />
        <path d={BODY_R} />
        <path d={HEAD_L} />
        <path d={HEAD_R} />
      </g>

      <g filter={url('raise')}>
        {muscles.map(([m, paths]) => {
          const cls = ['muscle', hover === m && 'is-hover', suggested.includes(m) && 'is-suggested'].filter(Boolean).join(' ');
          return (
            <g
              key={m}
              className={cls}
              style={rankStyle(rank.get(m)!)}
              data-muscle={m}
              role="button"
              tabIndex={0}
              aria-label={MUSCLE_BY_ID[m].name}
              onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(m)}
              onPointerLeave={() => onHover(null)}
              onClick={() => onSelect(m)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(m))}
            >
              {paths.map((d, i) => (
                <g key={i}>
                  <path d={d} className="muscle-shape" fill={url('muscle')} />
                  <path d={d} className="muscle-occlusion" fill={url('occlusion')} />
                  <path d={d} className="muscle-sheen" fill={url('sheen')} />
                </g>
              ))}
            </g>
          );
        })}
      </g>

      {layers.map(({ tone, overlay, leaving }) => (
        <g key={tone} className={`overlays ${tone} ${leaving ? 'leaving' : ''}`} filter={tone === 'volume' ? undefined : url('glow')}>
          {muscles.map(([m, paths]) => {
            // Kept in the DOM at zero so changes (like the weekly replay) fade both ways.
            const level = overlay.get(m) ?? 0;
            return paths.map((d, i) => (
              <path key={`${m}-${i}`} d={d} className="overlay" fill={tone === 'fatigue' ? url('heat') : undefined}
                style={{ opacity: level * (tone === 'fatigue' ? 0.95 : 0.7), '--i': rank.get(m) } as CSSProperties} />
            ));
          })}
        </g>
      ))}

      {/* Suggested muscles glow softly from inside as well as being outlined. */}
      <g className="suggest-glow" filter={url('glow')}>
        {muscles.flatMap(([m, paths]) => (suggested.includes(m) ? paths.map((d, i) => <path key={`${m}-${i}`} d={d} />) : []))}
      </g>

      <path d={`${BODY_L} ${BODY_R}`} fill={url('key')} pointerEvents="none" />

      <g className="details">
        {details.map((d, i) => <path key={i} d={d} />)}
      </g>

      {/* Injured areas: dashed outline above every overlay, so it reads in any mode. */}
      <g className="injured" pointerEvents="none">
        {muscles.flatMap(([m, paths]) =>
          paths.map((d, i) => (injured.get(m)?.has(bodySide(side, i)) ? <path key={`${m}-${i}`} d={d} /> : null)),
        )}
      </g>
    </svg>
  );
}

/** Keeps the previous mode's layer on screen for a moment after the mode changes. */
function useLayers(tone: OverlayTone, overlay: Map<MuscleId, number>): Layer[] {
  const [leaving, setLeaving] = useState<Layer | null>(null);
  const current = useRef<Layer>({ tone, overlay });
  if (current.current.tone !== tone) {
    const old = current.current;
    current.current = { tone, overlay };
    if (leaving?.tone !== old.tone) setLeaving({ ...old, leaving: true });
  } else {
    current.current = { tone, overlay };
  }
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLeaving(null), CROSSFADE_MS);
    return () => clearTimeout(t);
  }, [leaving]);
  return leaving && leaving.tone !== tone ? [leaving, current.current] : [current.current];
}

export function BodyMap({ overlay, tone, suggested, injured, onSelect, side, onSideChange, peek }: {
  overlay: Map<MuscleId, number>;
  tone: OverlayTone;
  suggested: MuscleId[];
  injured: Map<MuscleId, Set<BodySide>>;
  onSelect: (m: MuscleId) => void;
  side: Side;
  onSideChange: (side: Side) => void;
  /** What to show while a muscle is held down. */
  peek?: (m: MuscleId) => ReactNode;
}) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<MuscleId | null>(null);
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null);
  const [peeking, setPeeking] = useState<{ m: MuscleId; x: number; y: number } | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  /** Set by a pointer tap, so its click can wait for the ripple; a key press opens at once. */
  const tapped = useRef(false);
  const hold = useRef<ReturnType<typeof setTimeout>>(undefined);
  const root = useRef<HTMLDivElement>(null);
  const layers = useLayers(tone, overlay);

  const flip = () => onSideChange(side === 'front' ? 'back' : 'front');
  const local = (e: { clientX: number; clientY: number }) => {
    const r = root.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const endHold = () => {
    clearTimeout(hold.current);
    setPeeking(null);
  };
  useEffect(() => () => clearTimeout(hold.current), []);

  const onPointerDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
    suppressClick.current = false;
    tapped.current = false;
    const m = (e.target as Element).closest('[data-muscle]')?.getAttribute('data-muscle') as MuscleId | null;
    clearTimeout(hold.current);
    if (!m || !peek) return;
    const at = local(e);
    hold.current = setTimeout(() => {
      suppressClick.current = true;
      haptic();
      setPeeking({ m, ...at });
    }, PEEK_MS);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current && Math.hypot(e.clientX - drag.current.x, e.clientY - drag.current.y) > 8) clearTimeout(hold.current);
    if (drag.current && Math.abs(e.clientX - drag.current.x) > 12) drag.current.moved = true;
    if (e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: -py * MAX_TILT, y: px * MAX_TILT * 1.4 });
  };
  const onPointerUp = (e: PointerEvent) => {
    endHold();
    if (drag.current?.moved && Math.abs(e.clientX - drag.current.x) > 50) {
      suppressClick.current = true;
      flip();
    } else if (drag.current && !suppressClick.current) {
      tapped.current = true;
      setRipple({ ...local(e), key: e.timeStamp });
    }
    drag.current = null;
  };
  const select = (m: MuscleId) => {
    if (suppressClick.current) return;
    // A tap (not a key press) shows its ripple for a beat before the sheet opens.
    if (!tapped.current) return onSelect(m);
    tapped.current = false;
    setTimeout(() => onSelect(m), OPEN_DELAY_MS);
  };

  const rotateY = (side === 'back' ? 180 : 0) + tilt.y;
  const figureProps = { layers, suggested, injured, hover, onHover: setHover, onSelect: select };
  const width = root.current?.clientWidth ?? 0;

  return (
    <div className="bodymap" ref={root}>
      <div
        className="stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { drag.current = null; endHold(); }}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flipper" style={{ transform: `rotateX(${tilt.x}deg) rotateY(${rotateY}deg)` }}>
          <div className={`face face-front ${side === 'front' ? '' : 'inactive'}`} aria-hidden={side !== 'front'}>
            <Figure side="front" {...figureProps} />
          </div>
          <div className={`face face-back ${side === 'back' ? '' : 'inactive'}`} aria-hidden={side !== 'back'}>
            <Figure side="back" {...figureProps} />
          </div>
        </div>
      </div>
      {ripple && <span key={ripple.key} className="tap-ripple" style={{ left: ripple.x, top: ripple.y }} onAnimationEnd={() => setRipple(null)} />}
      {peeking && peek && (
        <div className="peek" role="status" style={{ left: Math.min(Math.max(peeking.x, 116), width - 116), top: peeking.y }}>
          {peek(peeking.m)}
        </div>
      )}
      <p className="hover-label" aria-live="polite">{hover ? MUSCLE_BY_ID[hover].name : '\u00a0'}</p>
    </div>
  );
}
