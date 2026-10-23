import { useEffect } from 'react';
import { Brand } from './Brand.tsx';
import { Icon, type IconName } from './Icon.tsx';

export type Route = 'body' | 'tracker' | 'records';

export const ROUTES: { id: Route; label: string; icon: IconName }[] = [
  { id: 'body', label: 'Body Map', icon: 'body' },
  { id: 'tracker', label: 'Tracker', icon: 'calendar' },
  { id: 'records', label: 'Personal Bests', icon: 'trophy' },
];

export function Drawer({ open, route, onClose }: { open: boolean; route: Route; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`drawer-backdrop ${open ? 'open' : ''}`} onClick={onClose} />
      <nav className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open} inert={!open}>
        <div className="drawer-head">
          <Brand />
          <button className="icon-btn" onClick={onClose} aria-label="Close menu"><Icon name="close" /></button>
        </div>
        <ul>
          {ROUTES.map((r) => (
            <li key={r.id}>
              <a href={`#/${r.id === 'body' ? '' : r.id}`} className={route === r.id ? 'active' : ''} onClick={onClose}>
                <Icon name={r.icon} /> {r.label}
              </a>
            </li>
          ))}
        </ul>
        <a className="drawer-foot" href="/api/export" download>
          <Icon name="download" size={18} /> Export backup
        </a>
      </nav>
    </>
  );
}
