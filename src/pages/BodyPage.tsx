import { useMemo, useState } from 'react';
import { MUSCLES, type MuscleId } from '../../shared/muscles.ts';
import { BodyMap, type OverlayTone } from '../components/BodyMap.tsx';
import { Icon } from '../components/Icon.tsx';
import { useData, useUi } from '../data.tsx';
import { daysSinceTrained, weeklySets } from '../lib/stats.ts';
import { useSession } from '../session.tsx';

type Mode = 'recovery' | 'volume' | 'neglected';

const MODES: { id: Mode; label: string; tone: OverlayTone }[] = [
  { id: 'recovery', label: 'Recovery', tone: 'fatigue' },
  { id: 'volume', label: 'Volume', tone: 'volume' },
  { id: 'neglected', label: 'Neglected', tone: 'neglect' },
];

const MODE_KEY = 'ember-body-mode';
const WEEKLY_TARGET = { min: 10, max: 20 };
const NEGLECTED_DAYS = 10;

function useMode() {
  const [mode, setMode] = useState<Mode>(() => {
    try {
      return (localStorage.getItem(MODE_KEY) as Mode) || 'recovery';
    } catch {
      return 'recovery';
    }
  });
  const choose = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {}
  };
  return [MODES.some((m) => m.id === mode) ? mode : 'recovery', choose] as const;
}

export function BodyPage() {
  const { fatigue, rec, activeSession, entries, exById, now } = useData();
  const { openMuscle, openPlan, openFootball, openSoreness } = useUi();
  const { startWorkout } = useSession();
  const [mode, setMode] = useMode();

  const volume = useMemo(() => weeklySets(entries, exById, now), [entries, exById, now]);
  const since = useMemo(() => daysSinceTrained(entries, exById, now), [entries, exById, now]);

  const overlay = useMemo(() => {
    const out = new Map<MuscleId, number>();
    for (const { id } of MUSCLES) {
      if (mode === 'recovery') out.set(id, fatigue.get(id)?.level ?? 0);
      else if (mode === 'volume') out.set(id, Math.min(1, (volume.get(id) ?? 0) / WEEKLY_TARGET.max));
      else out.set(id, (since.get(id) ?? Infinity) >= NEGLECTED_DAYS ? 1 : 0);
    }
    return out;
  }, [mode, fatigue, volume, since]);

  const recovering = MUSCLES.filter((m) => (fatigue.get(m.id)?.hoursLeft ?? 0) > 0).sort(
    (a, b) => fatigue.get(b.id)!.hoursLeft - fatigue.get(a.id)!.hoursLeft,
  );
  const under = MUSCLES.filter((m) => (volume.get(m.id) ?? 0) < WEEKLY_TARGET.min).sort(
    (a, b) => (volume.get(a.id) ?? 0) - (volume.get(b.id) ?? 0),
  );
  const neglected = MUSCLES.filter((m) => (since.get(m.id) ?? Infinity) >= NEGLECTED_DAYS).sort(
    (a, b) => (since.get(b.id) ?? Infinity) - (since.get(a.id) ?? Infinity),
  );
  const tone = MODES.find((m) => m.id === mode)!.tone;
  const sets = (n: number) => (Number.isInteger(n) ? n : n.toFixed(1));

  return (
    <div className="page body-page">
      <button className="today-card" onClick={openPlan}>
        <span className="today-icon"><Icon name="sparkle" /></span>
        <span>
          <span className="eyebrow">
            {rec.weekday}
            {rec.football && <span className="md-tag">{rec.football.label}</span>}
          </span>
          <strong>{rec.headline}</strong>
        </span>
        <Icon name="chevron" />
      </button>

      <div className="quick-actions">
        {!activeSession && (
          <button className="quick coral" onClick={startWorkout}>
            <Icon name="timer" size={18} /> Workout
          </button>
        )}
        <button className="quick pitch" onClick={openFootball}>
          <Icon name="ball" size={18} /> Football
        </button>
        <button className="quick" onClick={openSoreness}>
          <Icon name="pulse" size={18} /> Sore?
        </button>
      </div>

      <div className="segmented small mode-switch" role="tablist" aria-label="Body map view">
        {MODES.map((m) => (
          <button key={m.id} role="tab" aria-selected={mode === m.id} className={mode === m.id ? 'active' : ''} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>

      <BodyMap overlay={overlay} tone={tone} suggested={mode === 'recovery' ? rec.muscles : []} onSelect={(m) => openMuscle(m)} />

      {mode === 'recovery' && (
        <>
          <div className="legend">
            <span>Just trained</span>
            <span className="legend-bar" />
            <span>Recovered</span>
          </div>
          {recovering.length > 0 && (
            <div className="chips center">
              {recovering.map((m) => (
                <button key={m.id} className="chip recovering" onClick={() => openMuscle(m.id)}>
                  {m.name} · {Math.ceil(fatigue.get(m.id)!.hoursLeft)}h{fatigue.get(m.id)!.sore ? ' · sore' : ''}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {mode === 'volume' && (
        <>
          <div className="legend">
            <span>0 sets</span>
            <span className="legend-bar volume" />
            <span>{WEEKLY_TARGET.max}+ / week</span>
          </div>
          <p className="muted small center-text">
            Target {WEEKLY_TARGET.min}–{WEEKLY_TARGET.max} sets per muscle per week (assisting work counts half).
          </p>
          {under.length > 0 && (
            <div className="chips center">
              {under.map((m) => (
                <button key={m.id} className="chip under" onClick={() => openMuscle(m.id)}>
                  {m.name} · {sets(volume.get(m.id) ?? 0)}/{WEEKLY_TARGET.min}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {mode === 'neglected' && (
        <>
          <div className="legend">
            <span className="legend-swatch" />
            <span>No direct work in {NEGLECTED_DAYS}+ days</span>
          </div>
          {neglected.length > 0 ? (
            <div className="chips center">
              {neglected.map((m) => (
                <button key={m.id} className="chip neglect" onClick={() => openMuscle(m.id)}>
                  {m.name} · {since.has(m.id) ? `${since.get(m.id)}d` : 'never'}
                </button>
              ))}
            </div>
          ) : (
            <p className="muted small center-text">Nothing neglected — every muscle got work in the last {NEGLECTED_DAYS} days. 👏</p>
          )}
        </>
      )}
    </div>
  );
}
