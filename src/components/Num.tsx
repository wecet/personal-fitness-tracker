import { useEffect, useRef, useState } from 'react';
import { formatNum, parseNumText } from '../lib/numText.ts';

const DURATION = 700;
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A stat value that counts up to itself when it first appears and rolls to new values
 * after that. The unit is set smaller than the figure. Text that isn't a single number
 * ("—", "1:05") is shown as is.
 */
export function Num({ children }: { children: string | number }) {
  const text = String(children);
  const parsed = parseNumText(text);
  const target = parsed?.value ?? 0;
  const [shown, setShown] = useState(() => (reducedMotion() ? target : 0));
  const from = useRef(shown);

  useEffect(() => {
    if (!parsed || reducedMotion()) return setShown(target);
    const start = performance.now();
    const begin = from.current;
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / DURATION);
      const v = begin + (target - begin) * easeOut(t);
      from.current = v;
      setShown(v);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, !!parsed]);

  if (!parsed) return <>{text}</>;
  const unit = parsed.unit.trim();
  return (
    <span className="num">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {parsed.prefix}
        {formatNum(shown, parsed)}
        {parsed.magnitude}
        {unit && <span className="unit">{parsed.unit.startsWith(' ') ? ' ' : ''}{unit}</span>}
      </span>
    </span>
  );
}
