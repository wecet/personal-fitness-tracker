import { useData, useUi } from '../data.tsx';
import { useSession } from '../session.tsx';
import { Icon, type IconName } from './Icon.tsx';
import { Sheet } from './Sheet.tsx';

function Tile({ icon, label, tone, onClick }: { icon: IconName; label: string; tone?: string; onClick: () => void }) {
  return (
    <button className={`quick-tile ${tone ?? ''}`} onClick={onClick}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}

/**
 * The everyday logging actions behind the + button: one primary action and a few
 * equal alternatives. Rarer actions (soreness, injuries) live where they're used.
 */
export function QuickSheet({ onClose }: { onClose: () => void }) {
  const { routines } = useData();
  const { openFootball, openKind } = useUi();
  const { startWorkout } = useSession();

  const start = (routineId?: string) => {
    startWorkout(routineId);
    onClose();
  };

  return (
    <Sheet title="Log" onClose={onClose}>
      <button className="btn primary block" onClick={() => start()}>
        <Icon name="timer" size={18} /> Start workout
      </button>
      {routines.length > 0 && (
        <div className="chips quick-routines">
          {routines.map((r) => (
            <button key={r.id} className="chip" onClick={() => start(r.id)}>{r.name}</button>
          ))}
        </div>
      )}
      <div className="quick-tiles">
        <Tile icon="ball" tone="pitch" label="Football" onClick={openFootball} />
        <Tile icon="jump" label="Plyometrics" onClick={() => openKind('plyometric')} />
        <Tile icon="stretch" label="Mobility" onClick={() => openKind('mobility')} />
      </div>
    </Sheet>
  );
}
