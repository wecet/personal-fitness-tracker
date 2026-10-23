import { useRef, useState, type PointerEvent } from 'react';
import { MUSCLE_BY_ID, type MuscleId } from '../../shared/muscles.ts';
import type { MuscleFatigue } from '../lib/stats.ts';
import { BACK, BACK_DETAILS, FRONT, FRONT_DETAILS, HEAD, SILHOUETTE, VIEWBOX } from './bodyPaths.ts';
import { Icon } from './Icon.tsx';

type Side = 'front' | 'back';

const MIRROR = 'matrix(-1 0 0 1 200 0)';
const MAX_TILT = 9;

interface FigureProps {
  side: Side;
  fatigue: Map<MuscleId, MuscleFatigue>;
  suggested: MuscleId[];
  hover: MuscleId | null;
  onHover: (m: MuscleId | null) => void;
  onSelect: (m: MuscleId) => void;
}

function Figure({ side, fatigue, suggested, hover, onHover, onSelect }: FigureProps) {
  const map = side === 'front' ? FRONT : BACK;
  const details = side === 'front' ? FRONT_DETAILS : BACK_DETAILS;
  const id = (name: string) => `${side}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  return (
    <svg viewBox={VIEWBOX} className="figure" aria-label={`${side} view`}>
      <defs>
        {/* Halves are mirrored, so a left→right gradient reads as a rounded, centre-lit form. */}
        <linearGradient id={id('skin')} x1="0" x2="1">
          <stop offset="0" style={{ stopColor: 'var(--skin-edge)' }} />
          <stop offset="1" style={{ stopColor: 'var(--skin-core)' }} />
        </linearGradient>
        <radialGradient id={id('head')} cx="0.42" cy="0.35" r="0.7">
          <stop offset="0" style={{ stopColor: 'var(--skin-core)' }} />
          <stop offset="1" style={{ stopColor: 'var(--skin-edge)' }} />
        </radialGradient>
        <radialGradient id={id('muscle')} cx="0.62" cy="0.32" r="0.85">
          <stop offset="0" style={{ stopColor: 'var(--muscle-hi)' }} />
          <stop offset="0.55" style={{ stopColor: 'var(--muscle-mid)' }} />
          <stop offset="1" style={{ stopColor: 'var(--muscle-lo)' }} />
        </radialGradient>
        <radialGradient id={id('ground')}>
          <stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <filter id={id('lift')} x="-20%" y="-10%" width="140%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>

      <ellipse cx="100" cy="402" rx="52" ry="6" fill={url('ground')} />

      <g filter={url('lift')}>
        <path d={SILHOUETTE} fill={url('skin')} />
        <path d={SILHOUETTE} fill={url('skin')} transform={MIRROR} />
        <ellipse {...HEAD} fill={url('head')} />
      </g>

      {(Object.keys(map) as MuscleId[]).map((m) => {
        const level = fatigue.get(m)?.level ?? 0;
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
            {map[m]!.map((d, i) => (
              <g key={i}>
                <path d={d} className="muscle-shape" fill={url('muscle')} />
                <path d={d} className="muscle-shape" fill={url('muscle')} transform={MIRROR} />
                <path d={d} className="fatigue" style={{ opacity: level * 0.7 }} />
                <path d={d} className="fatigue" style={{ opacity: level * 0.7 }} transform={MIRROR} />
              </g>
            ))}
          </g>
        );
      })}

      <g className="details">
        <path d="M100,80 L100,216" />
        {details.map((d, i) => (
          <g key={i}>
            <path d={d} />
            <path d={d} transform={MIRROR} />
          </g>
        ))}
      </g>
    </svg>
  );
}

export function BodyMap({ fatigue, suggested, onSelect }: {
  fatigue: Map<MuscleId, MuscleFatigue>;
  suggested: MuscleId[];
  onSelect: (m: MuscleId) => void;
}) {
  const [side, setSide] = useState<Side>('front');
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<MuscleId | null>(null);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const flip = () => setSide((s) => (s === 'front' ? 'back' : 'front'));

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
  const figureProps = { fatigue, suggested, hover, onHover: setHover, onSelect: select };

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

      <div className="bodymap-controls">
        <div className="segmented" role="tablist">
          {(['front', 'back'] as const).map((s) => (
            <button key={s} role="tab" aria-selected={side === s} className={side === s ? 'active' : ''} onClick={() => setSide(s)}>
              {s === 'front' ? 'Front' : 'Back'}
            </button>
          ))}
        </div>
        <button className="icon-btn" onClick={flip} aria-label="Turn figure around">
          <Icon name="flip" />
        </button>
      </div>
      <p className="hover-label">{hover ? MUSCLE_BY_ID[hover].name : 'Tap a muscle to log a workout · swipe to turn'}</p>
    </div>
  );
}
