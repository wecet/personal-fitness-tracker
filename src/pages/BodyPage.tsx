import { useMemo, useState } from 'react';
import { MUSCLES, type MuscleId } from '../../shared/muscles.ts';
import { BodyMap, type OverlayTone, type Side } from '../components/BodyMap.tsx';
import { Icon } from '../components/Icon.tsx';
import { useData, useUi } from '../data.tsx';
import { daysSinceTrained, weeklySets } from '../lib/stats.ts';

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

/** "Chest, Quads and 2 more" */
const names = (ids: MuscleId[]) => {
  const n = ids.map((id) => MUSCLES.find((m) => m.id === id)!.name);
  return n.length <= 2 ? n.join(' and ') : `${n.slice(0, 2).join(', ')} and ${n.length - 2} more`;
};

export function BodyPage() {
  const { fatigue, rec, activeSession, entries, exById, now, load } = useData();
  const { openMuscle, openPlan, openQuick } = useUi();
  const [mode, setMode] = useMode();
  const [side, setSide] = useState<Side>('front');

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

  const recovering = MUSCLES.filter((m) => (fatigue.get(m.id)?.hoursLeft ?? 0) > 0)
    .sort((a, b) => fatigue.get(b.id)!.hoursLeft - fatigue.get(a.id)!.hoursLeft)
    .map((m) => m.id);
  const under = MUSCLES.filter((m) => (volume.get(m.id) ?? 0) < WEEKLY_TARGET.min).map((m) => m.id);
  const neglected = MUSCLES.filter((m) => (since.get(m.id) ?? Infinity) >= NEGLECTED_DAYS).map((m) => m.id);
  const spike = load.zone === 'spike';

  const caption =
    entries.length === 0
      ? 'Tap a muscle to log your first workout'
      : mode === 'recovery'
        ? recovering.length ? `${names(recovering)} recovering` : 'Everything is recovered'
        : mode === 'volume'
          ? under.length ? `${under.length} of ${MUSCLES.length} muscles under ${WEEKLY_TARGET.min} sets this week` : 'Every muscle hit its weekly target'
          : neglected.length ? `${names(neglected)} — no work in ${NEGLECTED_DAYS}+ days` : 'Nothing neglected';

  return (
    <div className="page home">
      <button className={`today-line ${spike ? 'warn' : ''}`} onClick={spike ? () => (location.hash = '#/progress/load') : openPlan}>
        <span className="today-day">{rec.weekday.slice(0, 3)}</span>
        {rec.football && !rec.headline.startsWith(rec.football.label) && <span className="md-tag">{rec.football.label}</span>}
        <span className="today-text">{spike ? `Load spike — ${load.ratio!.toFixed(1)}× your usual week` : rec.headline}</span>
        <Icon name="chevron" size={16} />
      </button>

      <BodyMap overlay={overlay} tone={MODES.find((m) => m.id === mode)!.tone} suggested={mode === 'recovery' ? rec.muscles : []}
        onSelect={(m) => openMuscle(m)} side={side} onSideChange={setSide} />

      <div className="home-controls">
        <div className="text-tabs" role="tablist" aria-label="Body map view">
          {MODES.map((m) => (
            <button key={m.id} role="tab" aria-selected={mode === m.id} className={mode === m.id ? 'active' : ''} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <button className="icon-btn" onClick={() => setSide(side === 'front' ? 'back' : 'front')} aria-label={`Show ${side === 'front' ? 'back' : 'front'}`}>
          <Icon name="flip" size={18} />
        </button>
      </div>
      <p className="home-caption">{caption}</p>

      {!activeSession && (
        <button className="fab" onClick={openQuick} aria-label="Log a workout, football or soreness">
          <Icon name="plus" size={26} />
        </button>
      )}
    </div>
  );
}
