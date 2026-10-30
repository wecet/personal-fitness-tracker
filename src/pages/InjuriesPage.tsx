import { useData, useUi } from '../data.tsx';
import { Icon } from '../components/Icon.tsx';
import { areaLabel, CONTEXT_LABEL, daysOut, injuryLabel, isActive, severity, type ProtocolStatus } from '../lib/injuries.ts';
import { dateKey } from '../lib/stats.ts';
import type { Injury } from '../../shared/types.ts';

const DAY = 86_400_000;

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
      <button className="btn ghost block" onClick={recovered}>Back to full training</button>
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
            <div><strong>{lastYear.length}</strong><span className="muted small">last 12 months</span></div>
            <div><strong>{daysLost}</strong><span className="muted small">days out</span></div>
            {common && common[1] > 1 && <div><strong>{common[0]}</strong><span className="muted small">most often</span></div>}
          </div>
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
