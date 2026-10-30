import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon.tsx';

/** Set when this sheet was opened from another one: going back returns to it. */
export const SheetBack = createContext<(() => void) | undefined>(undefined);

/** Bottom sheet on phones, centred dialog on wider screens. */
export function Sheet({ title, subtitle, onClose, children }: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const back = useContext(SheetBack);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (back ?? onClose)();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [onClose, back]);

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
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
