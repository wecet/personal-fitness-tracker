import { useEffect, useMemo, useState } from 'react';
import { MUSCLE_BY_ID, MUSCLES, type MuscleId } from '../../shared/muscles.ts';
import { BodyMap, type OverlayTone, type Side } from '../components/BodyMap.tsx';
import { Icon } from '../components/Icon.tsx';
import { useData, useUi } from '../data.tsx';
import { injuredSides, injuryLabel, isActive } from '../lib/injuries.ts';
import { READINESS_LABEL } from '../lib/readiness.ts';
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
const DAY = 86_400_000;
/** How far back the volume replay reaches, and how long each week stays on screen. */
const REPLAY_WEEKS = 12;
const REPLAY_STEP_MS = 900;

/** "18h" under a day, then "2 days". */
const timeLeft = (hours: number) => (hours < 24 ? `${Math.ceil(hours)}h` : `${Math.round(hours / 24)} day${Math.round(hours / 24) === 1 ? '' : 's'}`);
const ago = (days: number) => (days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`);

const dayMonth = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

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
  const { fatigue, rec, entries, exById, now, load, efforts, injuries, readiness } = useData();
  const { openMuscle, openPlan } = useUi();
  const [mode, setMode] = useMode();
  const [side, setSide] = useState<Side>('front');
  const [weeksBack, setWeeksBack] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Volume can be replayed week by week to show what's been building up or left behind.
  const firstAt = entries.length ? Date.parse(entries[0].performedAt) : now;
  const weeksAvailable = Math.min(REPLAY_WEEKS - 1, Math.floor((now - firstAt) / (7 * DAY)));
  const back = mode === 'volume' ? Math.min(weeksBack, weeksAvailable) : 0;
  const at = now - back * 7 * DAY;
  const weekLabel = back === 0 ? 'Last 7 days' : `${dayMonth(at - 6 * DAY)} – ${dayMonth(at)}`;

  useEffect(() => {
    if (!playing) return;
    if (weeksBack <= 0) return setPlaying(false);
    const t = setTimeout(() => setWeeksBack((w) => w - 1), REPLAY_STEP_MS);
    return () => clearTimeout(t);
  }, [playing, weeksBack]);

  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (weeksBack === 0) setWeeksBack(weeksAvailable);
    setPlaying(true);
  };

  const volume = useMemo(() => weeklySets(entries, exById, at, efforts), [entries, exById, at, efforts]);
  const since = useMemo(() => daysSinceTrained(entries, exById, now), [entries, exById, now]);
  const injured = useMemo(() => injuredSides(injuries), [injuries]);
  const activeInjuries = injuries.filter(isActive);

  const overlay = useMemo(() => {
    const out = new Map<MuscleId, number>();
    for (const { id } of MUSCLES) {
      if (mode === 'recovery') out.set(id, fatigue.get(id)?.level ?? 0);
      else if (mode === 'volume') out.set(id, Math.min(1, (volume.get(id) ?? 0) / WEEKLY_TARGET.max));
      else out.set(id, (since.get(id) ?? Infinity) >= NEGLECTED_DAYS ? 1 : 0);
    }
    return out;
  }, [mode, fatigue, volume, since]);

  const peek = (m: MuscleId) => {
    const hoursLeft = fatigue.get(m)?.hoursLeft ?? 0;
    const days = since.get(m);
    const sets = volume.get(m) ?? 0;
    const hurt = injured.has(m);
    return (
      <>
        <strong>{MUSCLE_BY_ID[m].name}</strong>
        <span className={`status ${hoursLeft > 0 ? 'recovering' : 'ready'}`}>
          {hoursLeft > 0 ? `Recovering · ${timeLeft(hoursLeft)} left` : 'Ready to train'}
        </span>
        <span className="muted">{days == null ? 'Not trained yet' : `Last trained ${ago(days)}`}</span>
        <span className="muted">{`${Math.round(sets * 10) / 10} hard sets ${back ? 'that week' : 'this week'}`}</span>
        {hurt && <span className="peek-injury">Injured</span>}
      </>
    );
  };

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
          ? under.length
            ? `${under.length} of ${MUSCLES.length} muscles under ${WEEKLY_TARGET.min} hard sets ${back ? 'that week' : 'this week'}`
            : `Every muscle hit its weekly target${back ? ' that week' : ''}`
          : neglected.length ? `${names(neglected)} — no work in ${NEGLECTED_DAYS}+ days` : 'Nothing neglected';

  return (
    <div className="page home">
      <button className={`today-line ${spike ? 'warn' : ''}`} onClick={spike ? () => (location.hash = '#/progress/load') : openPlan}>
        <span className="today-day">{rec.weekday.slice(0, 3)}</span>
        {rec.football && !rec.headline.startsWith(rec.football.label) && <span className="md-tag">{rec.football.label}</span>}
        {readiness && readiness !== 'push' && <span className={`ready-tag ${readiness}`}>{READINESS_LABEL[readiness]}</span>}
        <span className="today-text">{spike ? `Load spike — ${load.ratio!.toFixed(1)}× your usual week` : rec.headline}</span>
        <Icon name="chevron" size={16} />
      </button>

      <BodyMap overlay={overlay} tone={MODES.find((m) => m.id === mode)!.tone} suggested={mode === 'recovery' ? rec.muscles : []} injured={injured}
        onSelect={(m) => openMuscle(m)} side={side} onSideChange={setSide} peek={peek} />

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
      {mode === 'volume' && weeksAvailable > 0 && (
        <div className="replay">
          <button className="icon-btn small" onClick={togglePlay} aria-label={playing ? 'Pause replay' : 'Replay past weeks'}>
            <Icon name={playing ? 'pause' : 'play'} size={18} />
          </button>
          <input type="range" min={-weeksAvailable} max={0} step={1} value={-back} aria-label="Week shown" aria-valuetext={weekLabel}
            onChange={(e) => { setPlaying(false); setWeeksBack(-Number(e.target.value)); }} />
          <span className="replay-label">{weekLabel}</span>
        </div>
      )}
      <p className="home-caption">{caption}</p>
      {activeInjuries.length > 0 && (
        <a className="home-injury" href="#/injuries">
          <span className="injury-swatch" aria-hidden="true" />
          {activeInjuries.map(injuryLabel).join(', ')} — injured
        </a>
      )}

    </div>
  );
}
