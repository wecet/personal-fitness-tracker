import { useState, type FormEvent } from 'react';
import { MUSCLES, type MuscleCategory } from '../../shared/muscles.ts';
import { INJURY_CONTEXTS, JOINT_AREAS, type Injury, type InjuryArea, type InjuryContext, type InjurySide } from '../../shared/types.ts';
import { useData, useUi } from '../data.tsx';
import { areaLabel, CONTEXT_LABEL, daysOut, injuryLabel, severity, SIDE_LABEL } from '../lib/injuries.ts';
import { weeksBefore, type LoadZone } from '../lib/load.ts';
import { dateKey, parseDateKey } from '../lib/stats.ts';
import { newId } from '../lib/store.ts';
import { StackedColumns } from './charts.tsx';
import { Sheet } from './Sheet.tsx';

const WEEKS_BEFORE = 6;
const ZONE_PHRASE: Record<Exclude<LoadZone, 'baseline'>, string> = {
  low: 'lighter than usual',
  sweet: 'in the sweet spot',
  caution: 'above your usual, in the caution zone',
  spike: 'a spike, the zone linked to more injuries',
};
const dayMonth = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** The weeks of training leading up to an injury, against your usual load. */
function LoadBefore({ injury }: { injury: Injury }) {
  const { daily, firstDay, loadSeries } = useData();
  if (!firstDay || firstDay >= injury.startedAt) return null;
  const day = parseDateKey(injury.startedAt);
  const weeks = weeksBefore(daily, day, WEEKS_BEFORE);
  const dayBefore = dateKey(new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1));
  const w = loadSeries.find((x) => dateKey(x.day) === dayBefore);
  const totals = weeks.map((wk) => wk.gym + wk.football);
  const last = totals.at(-1)!;
  const prior = totals.slice(-4, -1).filter((t) => t > 0);
  const avg = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : 0;

  const summary =
    w?.ratio != null && w.zone !== 'baseline'
      ? `The day before, your recent load was ${w.ratio.toFixed(1)}× your usual: ${ZONE_PHRASE[w.zone]}.`
      : avg > 0
        ? `The week before was ${Math.round(Math.abs(last / avg - 1) * 100)}% ${last >= avg ? 'above' : 'below'} the three weeks before it.`
        : 'Not much training logged before it to compare with.';

  return (
    <section className="load-before">
      <h3 className="section-title">Load before it happened</h3>
      <p className="small">{summary}</p>
      <StackedColumns
        height={150}
        bars={weeks.map((wk, i) => ({
          label: `${WEEKS_BEFORE - i}w`,
          title: `${dayMonth(wk.start)} – ${dayMonth(wk.end)}`,
          values: [wk.gym, wk.football],
        }))}
        series={[{ name: 'Gym', color: 'var(--chart-1)' }, { name: 'Football', color: 'var(--chart-2)' }]}
        label={`Weekly training load in the ${WEEKS_BEFORE} weeks before the injury`}
        formatY={(n) => `${Math.round(n)} AU`}
      />
    </section>
  );
}

const CATEGORIES: [MuscleCategory, string][] = [
  ['legs', 'Legs'],
  ['core', 'Core'],
  ['pull', 'Pull'],
  ['push', 'Push'],
];

const GROUPS: [string, InjuryArea[]][] = [
  ['Joints', JOINT_AREAS],
  ...CATEGORIES.map(([c, label]): [string, InjuryArea[]] => [label, MUSCLES.filter((m) => m.category === c).map((m) => m.id)]),
];

const SIDES: InjurySide[] = ['left', 'right', 'both'];

export function InjurySheet({ injuryId, onClose }: { injuryId?: string; onClose: () => void }) {
  const { injuries, settings, put, remove } = useData();
  const { notify } = useUi();
  const today = dateKey(new Date());
  const existing = injuries.find((i) => i.id === injuryId);
  const playedToday = settings.matchDays.includes(new Date().getDay()) ? 'match' : settings.trainingDays.includes(new Date().getDay()) ? 'training' : 'other';

  const [area, setArea] = useState<InjuryArea | null>(existing?.area ?? null);
  const [side, setSide] = useState<InjurySide | null>(existing?.side ?? null);
  const [startedAt, setStartedAt] = useState(existing?.startedAt ?? today);
  const [context, setContext] = useState<InjuryContext>(existing?.context ?? playedToday);
  const [resolvedAt, setResolvedAt] = useState<string | null>(existing?.resolvedAt ?? null);
  const [note, setNote] = useState(existing?.note ?? '');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!area) return;
    const injury: Injury = {
      id: existing?.id ?? newId(),
      area,
      side,
      startedAt,
      resolvedAt: resolvedAt && resolvedAt < startedAt ? startedAt : resolvedAt,
      context,
      note: note.trim() || null,
      stage: existing?.stage ?? 0,
    };
    put('injury', injury);
    notify(
      injury.resolvedAt
        ? `${injuryLabel(injury)} marked recovered · ${severity(daysOut(injury)).toLowerCase()}`
        : existing ? 'Injury updated' : `${injuryLabel(injury)} logged — it’s left out of your plan until it heals`,
    );
    onClose();
  }

  function del() {
    if (!existing || !confirm('Delete this injury from your history?')) return;
    remove('injury', existing.id);
    onClose();
  }

  return (
    <Sheet title={existing ? injuryLabel(existing) : 'Log an injury'} subtitle={existing ? `Since ${existing.startedAt}` : 'Where does it hurt?'} onClose={onClose}>
      {existing && <LoadBefore injury={existing} />}
      <form className="injury-form" onSubmit={submit}>
        {GROUPS.map(([label, areas]) => (
          <div key={label} className="sore-group">
            <h3 className="section-title">{label}</h3>
            <div className="chips">
              {areas.map((a) => (
                <button key={a} type="button" className={`chip ${area === a ? 'coral' : ''}`} aria-pressed={area === a} onClick={() => setArea(a)}>
                  {areaLabel(a)}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="field">
          <span className="field-head"><span>Side</span></span>
          <div className="segmented wide" role="radiogroup" aria-label="Side">
            {SIDES.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={side === s} className={side === s ? 'active' : ''} onClick={() => setSide(side === s ? null : s)}>
                {SIDE_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-head"><span>How did it happen?</span></span>
          <div className="segmented wide" role="radiogroup" aria-label="Where it happened">
            {INJURY_CONTEXTS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={context === c} className={context === c ? 'active' : ''} onClick={() => setContext(c)}>
                {CONTEXT_LABEL[c]}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span className="field-head"><span>Started</span></span>
          <input type="date" className="date-input" value={startedAt} max={today} onChange={(e) => setStartedAt(e.target.value || today)} />
        </label>

        {existing && (
          <label className="field check-field">
            <input type="checkbox" checked={!!resolvedAt} onChange={(e) => setResolvedAt(e.target.checked ? today : null)} />
            <span>Back to full training</span>
            {resolvedAt && (
              <input type="date" className="date-input" value={resolvedAt} min={startedAt} max={today}
                onChange={(e) => setResolvedAt(e.target.value || today)} aria-label="Back to full training on" />
            )}
          </label>
        )}

        <label className="field">
          <span className="field-head"><span>Notes</span></span>
          <textarea rows={2} maxLength={500} placeholder="What happened, physio advice…" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <button className="btn primary block" disabled={!area}>{existing ? 'Save' : 'Log injury'}</button>
        {existing && <button type="button" className="btn ghost block danger" onClick={del}>Delete</button>}
      </form>
    </Sheet>
  );
}
