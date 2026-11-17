/** The logo's three rising bars: training load building to full heat. */
const BARS = [
  { x: 3, y: 13, h: 8 },
  { x: 9.75, y: 8.5, h: 12.5 },
  { x: 16.5, y: 3, h: 18 },
];

/**
 * The bars as a gauge: the first `level` bars are lit, the rest are faint. Used
 * wherever the app shows a level of three — like today's readiness.
 */
export function Bars({ level, size = 14, label }: { level: 1 | 2 | 3; size?: number; label?: string }) {
  return (
    <svg className="bars" width={size} height={size} viewBox="0 0 24 24" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {BARS.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width="4.5" height={b.h} rx="2.25" className={i < level ? 'on' : 'off'} />
      ))}
    </svg>
  );
}

export function Brand() {
  return (
    <span className="brand">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        {BARS.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width="4.5" height={b.h} rx="2.25" fill="var(--coral)" opacity={[0.4, 0.7, 1][i]} />
        ))}
      </svg>
      tempo
    </span>
  );
}
