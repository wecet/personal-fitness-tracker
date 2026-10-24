import { useData, useUi } from '../data.tsx';
import { useSession } from '../session.tsx';
import { Icon, type IconName } from './Icon.tsx';
import { Sheet } from './Sheet.tsx';

function Action({ icon, title, detail, tone, onClick }: { icon: IconName; title: string; detail?: string; tone?: string; onClick: () => void }) {
  return (
    <button className={`quick-action ${tone ?? ''}`} onClick={onClick}>
      <span className="quick-action-icon"><Icon name={icon} /></span>
      <span>
        <strong>{title}</strong>
        {detail && <span className="muted small">{detail}</span>}
      </span>
    </button>
  );
}

/** Everything you can log from home, behind the + button. */
export function QuickSheet({ onClose }: { onClose: () => void }) {
  const { routines, activeSession } = useData();
  const { openFootball, openSoreness, openRoutine } = useUi();
  const { startWorkout } = useSession();

  const start = (routineId?: string) => {
    startWorkout(routineId);
    onClose();
  };

  return (
    <Sheet title="Log" onClose={onClose}>
      <div className="quick-actions-list">
        {!activeSession && <Action icon="timer" tone="coral" title="Start workout" detail="Rest timer and summary" onClick={() => start()} />}
        {!activeSession &&
          routines.map((r) => (
            <Action key={r.id} icon="list" title={r.name} detail={`Start routine · ${r.items.length} exercises`} onClick={() => start(r.id)} />
          ))}
        {!activeSession && routines.length === 0 && (
          <Action icon="list" title="Create a routine" detail="Save a workout you repeat" onClick={() => openRoutine()} />
        )}
        <Action icon="ball" tone="pitch" title="Log football" detail="Match or training" onClick={openFootball} />
        <Action icon="pulse" title="How do you feel?" detail="Mark sore muscles" onClick={openSoreness} />
      </div>
    </Sheet>
  );
}
