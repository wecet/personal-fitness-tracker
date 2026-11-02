import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon.tsx';

/** Set when this sheet was opened from another one: going back returns to it. */
export const SheetBack = createContext<(() => void) | undefined>(undefined);

/** Pull this far, or flick this fast (px/ms), to dismiss. */
const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 0.5;

/** Bottom sheet on phones, centred dialog on wider screens. */
export function Sheet({ title, subtitle, onClose, children }: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const back = useContext(SheetBack);
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (back ?? onClose)();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [onClose, back]);

  useEffect(() => swipeToClose(sheetRef.current!, backdropRef.current!, () => close.current()), []);

  return createPortal(
    <div className="sheet-backdrop" ref={backdropRef} onClick={onClose}>
      <div className="sheet" ref={sheetRef} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <header className={`sheet-header ${back ? 'with-back' : ''}`}>
          {back && (
            <button className="icon-btn" onClick={back} aria-label="Back">
              <Icon name="chevronLeft" />
            </button>
          )}
          <div className="sheet-title">
            <h2>{title}</h2>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Drag the sheet down to dismiss it. A pull from the grip or header always moves the
 * sheet; one from the content only does once everything under the finger is scrolled
 * to the top, so scrolling, sliders and sideways chart scrubbing keep working.
 */
function swipeToClose(sheet: HTMLElement, backdrop: HTMLElement, onClose: () => void) {
  const dialog = matchMedia('(min-width: 700px)');
  let start: { x: number; y: number } | null = null;
  let dragging = false;
  let dy = 0;
  let last = { y: 0, t: 0, v: 0 };

  const atTop = (el: Element | null) => {
    for (; el && el !== sheet; el = el.parentElement) if (el.scrollTop > 0) return false;
    return true;
  };
  const place = (y: number, animate: boolean) => {
    const transition = animate ? 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.25s' : 'none';
    sheet.style.transition = transition;
    backdrop.style.transition = transition;
    sheet.style.transform = y ? `translateY(${y}px)` : '';
    backdrop.style.backgroundColor = y ? `rgb(0 0 0 / ${0.55 * Math.max(0, 1 - y / sheet.offsetHeight)})` : '';
  };

  const onStart = (e: TouchEvent) => {
    if (dialog.matches || e.touches.length > 1) return (start = null);
    const target = e.target as Element;
    if (target.closest('input[type="range"], textarea')) return (start = null);
    const t = e.touches[0];
    // From the grip or header, always; from the content, only with nothing left to scroll up.
    if (!target.closest('.sheet-grip, .sheet-header') && !atTop(target)) return (start = null);
    start = { x: t.clientX, y: t.clientY };
    dragging = false;
    dy = 0;
    last = { y: t.clientY, t: e.timeStamp, v: 0 };
  };

  const onMove = (e: TouchEvent) => {
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dyNow = t.clientY - start.y;
    if (!dragging) {
      // Upward or sideways: leave it to scrolling and the chart scrubber.
      if (dyNow < 0 || Math.abs(dx) > Math.abs(dyNow)) {
        if (Math.hypot(dx, dyNow) >= 8) start = null;
        return;
      }
      // Claim a downward pull from its first move, or iOS starts its own bounce and
      // ignores preventDefault for the rest of the gesture.
      if (e.cancelable) e.preventDefault();
      if (dyNow < 8) return;
      dragging = true;
    }
    if (e.cancelable) e.preventDefault();
    const raw = t.clientY - start.y;
    dy = raw > 0 ? raw : raw / 4; // resist pulling up past the top
    const dt = e.timeStamp - last.t;
    if (dt > 0) last = { y: t.clientY, t: e.timeStamp, v: (t.clientY - last.y) / dt };
    place(dy, false);
  };

  const onEnd = (e: TouchEvent) => {
    if (!start) return;
    start = null;
    if (!dragging) return;
    dragging = false;
    const flick = e.timeStamp - last.t < 100 && last.v > CLOSE_VELOCITY;
    if (dy > CLOSE_DISTANCE || (flick && dy > 0)) {
      place(sheet.offsetHeight, true);
      setTimeout(onClose, 200);
    } else {
      place(0, true);
    }
  };

  sheet.addEventListener('touchstart', onStart, { passive: true });
  sheet.addEventListener('touchmove', onMove, { passive: false });
  sheet.addEventListener('touchend', onEnd);
  sheet.addEventListener('touchcancel', onEnd);
  return () => {
    sheet.removeEventListener('touchstart', onStart);
    sheet.removeEventListener('touchmove', onMove);
    sheet.removeEventListener('touchend', onEnd);
    sheet.removeEventListener('touchcancel', onEnd);
  };
}
