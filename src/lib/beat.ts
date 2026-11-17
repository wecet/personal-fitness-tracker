/*
 * Keeps every looping animation on one shared beat. CSS animations start when
 * their element appears, so two pulses that should match drift apart. When a
 * looping animation starts, its start time is moved onto the beat grid,
 * so everything that pulses does so together. The beat itself is --beat in
 * styles.css.
 */

/** Loops that keep time: their durations are whole multiples of --beat. */
const ON_BEAT = new Set(['pulse', 'glow', 'suggest', 'breathe', 'beat']);

/**
 * The next beat at or after `now`. Moving a start forward (never back) means a
 * loop waits a moment at rest rather than jumping into the middle of its cycle;
 * every beat loop's keyframes begin at rest.
 */
export const onGrid = (now: number, beatMs: number) => Math.ceil(now / beatMs) * beatMs;

function beatMs(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--beat').trim();
  const n = parseFloat(raw);
  return raw.endsWith('ms') ? n : n * 1000 || 900;
}

export function keepTime() {
  if (typeof document === 'undefined' || !('getAnimations' in Element.prototype)) return;
  const beat = beatMs();
  document.addEventListener('animationstart', (e) => {
    if (!ON_BEAT.has(e.animationName) || !(e.target instanceof Element)) return;
    const now = document.timeline.currentTime;
    if (typeof now !== 'number') return;
    for (const a of e.target.getAnimations()) {
      // Only the animation that just started. Its delay still counts from the grid
      // point, so deliberate offsets (the logo's bars rising in turn) are kept.
      if ((a as CSSAnimation).animationName !== e.animationName || a.startTime == null) continue;
      a.startTime = onGrid(Number(a.startTime), beat);
    }
  });
}
