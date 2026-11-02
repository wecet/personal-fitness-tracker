import { useData, useUi } from '../data.tsx';
import { Icon } from '../components/Icon.tsx';
import { areaLabel, CONTEXT_LABEL, daysOut, injuryLabel, isActive, returnStages, severity, stagesCleared, timeline, type ProtocolStatus } from '../lib/injuries.ts';
import { haptic } from '../lib/haptics.ts';
import { dateKey } from '../lib/stats.ts';
import type { Injury } from '../../shared/types.ts';
import { Num } from '../components/Num.tsx';

const DAY = 86_400_000;

const MONTH_MS = 365 * DAY;

/** A year of injuries as bars, one lane per overlap; tap targets are the list below it. */
function InjuryTimeline({ injuries }: { injuries: Injury[] }) {
  const today = dateKey(new Date());
  const bars = timeline(injuries, today);
  if (bars.length === 0) return null;
  const lanes = Math.max(...bars.map((b) => b.lane)) + 1;
  const end = new Date(`${today}T00:00`).getTime() + DAY;
  const start = end - MONTH_MS;
  const months = Array.from({ length: 12 }, (_, k) => {
    const d = new Date(end);
    d.setDate(1);
    d.setMonth(d.getMonth() - k);
    return { x: (d.getTime() - start) / MONTH_MS, label: d.toLocaleDateString(undefined, { month: 'narrow' }) };
  }).filter((m) => m.x >= 0 && m.x < 0.98);

  return (
    <div className="injury-timeline" aria-hidden="true">
      <div className="timeline-track" style={{ height: lanes * 14 + 4 }}>
        {months.map((m) => <span key={m.x} className="timeline-tick" style={{ left: `${m.x * 100}%` }} />)}
        {bars.map(({ injury, from, to, lane }) => (
          <span key={injury.id} className={`timeline-bar ${isActive(injury) ? 'active' : `sev-${severity(daysOut(injury)).toLowerCase()}`}`}
            style={{ left: `${from * 100}%`, width: `max(6px, ${(to - from) * 100}%)`, top: lane * 14 + 2 }} />
        ))}
      </div>
      <div className="timeline-months">
        {months.map((m) => <span key={m.x} style={{ left: `${m.x * 100}%` }}>{m.label}</span>)}
      </div>
    </div>
  );
}

/** Criteria to clear in order before full training: tap the next one when it's true. */
function ReturnToPlay({ injury }: { injury: Injury }) {
  const { put } = useData();
  const stages = returnStages(injury);
  const cleared = stagesCleared(injury);
  const set = (stage: number) => {
    haptic();
    put('injury', { ...injury, stage });
  };
  return (
    <div className="rtp">
      <div className="card-head">
        <h4>Return to play</h4>
        <span className="muted small">{cleared}/{stages.length} cleared</span>
      </div>
      <ol>
        {stages.map((st, i) => {
          const state = i < cleared ? 'done' : i === cleared ? 'next' : 'later';
          return (
            <li key={st.name} className={state}>
              <button onClick={() => set(i < cleared ? i : i + 1)} aria-pressed={i < cleared} disabled={state === 'later'}>
                <span className="rtp-check" aria-hidden="true">{i < cleared ? '✓' : i + 1}</span>
                <span className="rtp-text">
                  <span>{st.name}</span>
                  {state === 'next' && <span className="muted small">{st.detail}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const longDate = (key: string) => new Date(`${key}T12:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function ProtocolRow({ status }: { status: ProtocolStatus }) {
  const { exercises } = useData();
  const { openMuscle, openKind } = useUi();
  const { protocol, done, priority, blocked } = status;
  const met = done >= protocol.target;

  function log() {
    if (protocol.exercises === 'plyometric') return openKind('plyometric');
    const ex = exercises.find((e) => e.name === protocol.exercises[0]);
    if (ex) openMuscle(ex.muscle, ex.id);
  }

  return (
    <li>
      <button className={`protocol ${met ? 'met' : ''}`} onClick={log}>
        <span className="protocol-main">
          <span className="protocol-title">
            <strong>{protocol.name}</strong>
            <span className="muted small">{protocol.region}</span>
            {blocked ? <span className="tag injury">Rehab first</span> : priority && <span className="tag priority">Priority</span>}
          </span>
          <span className="muted small">{protocol.why}</span>
        </span>
        <span className="protocol-count" aria-label={`${done} of ${protocol.target} this week`}>
          <span className="pips">
            {Array.from({ length: protocol.target }, (_, i) => <span key={i} className={i < done ? 'on' : ''} />)}
          </span>
          <span className="small">{Math.min(done, protocol.target)}/{protocol.target}</span>
        </span>
      </button>
    </li>
  );
}

function ActiveInjury({ injury }: { injury: Injury }) {
  const { put } = useData();
  const { openInjury, notify } = useUi();
  const day = daysOut(injury) + 1;

  function recovered() {
    const done = { ...injury, resolvedAt: dateKey(new Date()) };
    put('injury', done);
    notify(`Welcome back! ${injuryLabel(injury)} · ${daysOut(done)} days out`, 'default', { label: 'Undo', run: () => put('injury', injury) });
  }

  return (
    <section className="card injury-card">
      <div className="injury-head">
        <div>
          <h3>{injuryLabel(injury)}</h3>
          <p className="muted small">Day {day} · {CONTEXT_LABEL[injury.context]} · since {longDate(injury.startedAt)}</p>
        </div>
        <button className="icon-btn small" onClick={() => openInjury(injury.id)} aria-label="Edit injury"><Icon name="settings" size={18} /></button>
      </div>
      {injury.note && <p className="injury-note">{injury.note}</p>}
      <ReturnToPlay injury={injury} />
      <button className={`btn block ${stagesCleared(injury) >= returnStages(injury).length ? 'primary' : 'ghost'}`} onClick={recovered}>
        Back to full training
      </button>
    </section>
  );
}

export function InjuriesPage() {
  const { injuries, prevention } = useData();
  const { openInjury } = useUi();
  const active = injuries.filter(isActive);
  const past = injuries.filter((i) => !isActive(i));
  const yearAgo = dateKey(new Date(Date.now() - 365 * DAY));
  const lastYear = injuries.filter((i) => !i.resolvedAt || i.resolvedAt >= yearAgo);
  const daysLost = lastYear.reduce((sum, i) => sum + daysOut(i), 0);
  const byArea = new Map<string, number>();
  for (const i of injuries) byArea.set(areaLabel(i.area), (byArea.get(areaLabel(i.area)) ?? 0) + 1);
  const common = [...byArea].sort((a, b) => b[1] - a[1])[0];
  const totalDone = prevention.filter((s) => s.done >= s.protocol.target).length;

  return (
    <div className="page injuries">
      <section className="card">
        <div className="card-head">
          <h3>Prevention this week</h3>
          <span className="muted small">{totalDone}/{prevention.length} done</span>
        </div>
        <ul className="protocols">
          {prevention.map((s) => <ProtocolRow key={s.protocol.id} status={s} />)}
        </ul>
      </section>

      {active.map((i) => <ActiveInjury key={i.id} injury={i} />)}

      <button className="btn ghost block" onClick={() => openInjury()}>
        <Icon name="plus" size={16} /> Log an injury
      </button>

      {injuries.length > 0 && (
        <section className="card">
          <h3>Injury history</h3>
          <div className="stat-row">
            <div><strong><Num>{lastYear.length}</Num></strong><span className="muted small">last 12 months</span></div>
            <div><strong><Num>{daysLost}</Num></strong><span className="muted small">days out</span></div>
            {common && common[1] > 1 && <div><strong>{common[0]}</strong><span className="muted small">most often</span></div>}
          </div>
          <InjuryTimeline injuries={injuries} />
          {past.length > 0 && (
            <ul className="injury-history">
              {past.map((i) => {
                const days = daysOut(i);
                return (
                  <li key={i.id}>
                    <button onClick={() => openInjury(i.id)}>
                      <span>
                        <strong>{injuryLabel(i)}</strong>
                        <span className="muted small">{longDate(i.startedAt)} · {CONTEXT_LABEL[i.context]}</span>
                      </span>
                      <span className="muted small">{days} day{days === 1 ? '' : 's'}</span>
                      <span className={`tag sev-${severity(days).toLowerCase()}`}>{severity(days)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      <p className="muted small page-note">
        Prevention programmes come from trials in footballers. A past injury is the biggest risk factor for the next, so those regions are marked as a priority. Not medical advice — see a physio for anything that lingers.
      </p>
    </div>
  );
}
