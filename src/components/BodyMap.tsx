import { useRef, useState, type PointerEvent } from 'react';
import { MUSCLE_BY_ID, type MuscleId } from '../../shared/muscles.ts';
import type { BodySide } from '../lib/injuries.ts';
import { BACK, BACK_DETAILS, both, EAR, FRONT, FRONT_DETAILS, HEAD, SILHOUETTE, VIEWBOX } from './bodyPaths.ts';

export type Side = 'front' | 'back';

export type OverlayTone = 'fatigue' | 'volume' | 'neglect';

const MAX_TILT = 9;

/** Both halves of every shape, computed once. */
const FIGURES = {
  front: {
    muscles: Object.entries(FRONT).map(([m, ds]) => [m as MuscleId, ds!.flatMap(both)] as const),
    details: ['M100,80 L100,216', ...FRONT_DETAILS.flatMap(both)],
  },
  back: {
    muscles: Object.entries(BACK).map(([m, ds]) => [m as MuscleId, ds!.flatMap(both)] as const),
    details: ['M100,60 L100,212', ...BACK_DETAILS.flatMap(both)],
  },
};
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
  /** 0–1 fill strength per muscle. */
  overlay: Map<MuscleId, number>;
  tone: OverlayTone;
  suggested: MuscleId[];
  injured: Map<MuscleId, Set<BodySide>>;
  hover: MuscleId | null;
  onHover: (m: MuscleId | null) => void;
  onSelect: (m: MuscleId) => void;
}

function Figure({ side, overlay, tone, suggested, injured, hover, onHover, onSelect }: FigureProps) {
  const { muscles, details } = FIGURES[side];
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
        <radialGradient id={id('key')} gradientUnits="userSpaceOnUse" cx="60" cy="70" r="260">
          <stop offset="0" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        {/* Ember heat: hot core, deep red edges. */}
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

      <ellipse cx="100" cy="403" rx="58" ry="7" fill={url('ground')} />
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
                  <path d={d} className="muscle-sheen" fill={url('sheen')} />
                </g>
              ))}
            </g>
          );
        })}
      </g>

      <g className={`overlays ${tone}`} filter={tone === 'volume' ? undefined : url('glow')}>
        {muscles.map(([m, paths]) => {
          const level = overlay.get(m) ?? 0;
          if (level < 0.02) return null;
          return paths.map((d, i) => (
            <path key={`${m}-${i}`} d={d} className="overlay" fill={tone === 'fatigue' ? url('heat') : undefined}
              style={{ opacity: level * (tone === 'fatigue' ? 0.95 : 0.7) }} />
          ));
        })}
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

export function BodyMap({ overlay, tone, suggested, injured, onSelect, side, onSideChange }: {
  overlay: Map<MuscleId, number>;
  tone: OverlayTone;
  suggested: MuscleId[];
  injured: Map<MuscleId, Set<BodySide>>;
  onSelect: (m: MuscleId) => void;
  side: Side;
  onSideChange: (side: Side) => void;
}) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<MuscleId | null>(null);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const flip = () => onSideChange(side === 'front' ? 'back' : 'front');

  const onPointerDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, moved: false };
    suppressClick.current = false;
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current && Math.abs(e.clientX - drag.current.x) > 12) drag.current.moved = true;
    if (e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: -py * MAX_TILT, y: px * MAX_TILT * 1.4 });
  };
  const onPointerUp = (e: PointerEvent) => {
    if (drag.current?.moved && Math.abs(e.clientX - drag.current.x) > 50) {
      suppressClick.current = true;
      flip();
    }
    drag.current = null;
  };
  const select = (m: MuscleId) => {
    if (suppressClick.current) return;
    onSelect(m);
  };

  const rotateY = (side === 'back' ? 180 : 0) + tilt.y;
  const figureProps = { overlay, tone, suggested, injured, hover, onHover: setHover, onSelect: select };

  return (
    <div className="bodymap">
      <div
        className="stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
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
      <p className="hover-label" aria-live="polite">{hover ? MUSCLE_BY_ID[hover].name : '\u00a0'}</p>
    </div>
  );
}
