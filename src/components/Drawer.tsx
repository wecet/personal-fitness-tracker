import { useEffect } from 'react';
import { Brand } from './Brand.tsx';
import { Icon, type IconName } from './Icon.tsx';

export type Route = 'body' | 'tracker' | 'routines' | 'progress' | 'settings';

export const ROUTES: { id: Route; label: string; icon: IconName }[] = [
  { id: 'body', label: 'Home', icon: 'body' },
  { id: 'tracker', label: 'Tracker', icon: 'calendar' },
  { id: 'routines', label: 'Routines', icon: 'list' },
  { id: 'progress', label: 'Progress', icon: 'chart' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const MAIN = ROUTES.filter((r) => r.id !== 'settings');
const href = (r: Route) => `#/${r === 'body' ? '' : r}`;

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
        </div>
        <ul>
          {MAIN.map((r) => (
            <li key={r.id}>
              <a href={href(r.id)} className={route === r.id ? 'active' : ''} onClick={onClose}>
                <Icon name={r.icon} /> {r.label}
              </a>
            </li>
          ))}
        </ul>
        <a className={`drawer-foot ${route === 'settings' ? 'active' : ''}`} href={href('settings')} onClick={onClose}>
          <Icon name="settings" size={18} /> Settings
        </a>
      </nav>
    </>
  );
}
