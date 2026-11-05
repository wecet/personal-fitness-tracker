import { useEffect, useState } from 'react';
import { api, type BackupStatus } from '../api.ts';
import { useAccount, useLogOut } from '../auth.tsx';
import { Icon } from '../components/Icon.tsx';
import { PlateSheet } from '../components/PlateSheet.tsx';
import { useData, useUi } from '../data.tsx';
import { ScienceSection } from './ScienceSection.tsx';
import { formatDuration, WEEKDAYS } from '../lib/stats.ts';
import type { Settings } from '../../shared/types.ts';

const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

function DayPicker({ label, hint, value, onChange }: {
  label: string;
  hint: string;
  value: number[];
  onChange: (days: number[]) => void;
}) {
  const toggle = (d: number) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);
  return (
    <div className="field">
      <span className="field-head"><span>{label}</span></span>
      <div className="day-picker" role="group" aria-label={label}>
        {MON_FIRST.map((d) => (
          <button key={d} type="button" aria-pressed={value.includes(d)} className={value.includes(d) ? 'active' : ''} onClick={() => toggle(d)}>
            {WEEKDAYS[d].slice(0, 3)}
          </button>
        ))}
      </div>
      <p className="muted small">{hint}</p>
    </div>
  );
}

/** "today, 03:00" or "28 Oct, 03:00" */
function when(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const today = d.toDateString() === new Date().toDateString();
  return `${today ? 'today' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`;
}

/** The server copies the database once a day; this shows the last copy and makes one on demand. */
function BackupRow() {
  const { notify } = useUi();
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.backups().then(setStatus, () => {});
  }, []);

  async function backUp() {
    setBusy(true);
    try {
      setStatus(await api.backupNow());
      notify('Backed up');
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const detail = !status ? 'Automatic daily backups' : status.latest ? `Last ${when(status.latest.at)} · ${status.count} kept` : 'No backups yet';
  return (
    <button className="tool-row" onClick={backUp} disabled={busy}>
      <Icon name="shield" />
      <span className="tool-text">
        {busy ? 'Backing up…' : 'Back up now'}
        <span className="muted small">{detail}</span>
      </span>
    </button>
  );
}

function AccountCard() {
  const { user } = useAccount();
  const { logOut, busy } = useLogOut();
  return (
    <section className="card account-card">
      <div className="account-row">
        <span className="account-avatar" aria-hidden="true">{user.email[0].toUpperCase()}</span>
        <span className="tool-text">
          <span className="small muted">Signed in as</span>
          <strong className="account-email">{user.email}</strong>
        </span>
        <button className="btn ghost" onClick={logOut} disabled={busy}>{busy ? 'Logging out…' : 'Log out'}</button>
      </div>
    </section>
  );
}

export function SettingsPage() {
  const { settings, put } = useData();
  const update = (patch: Partial<Settings>) => put('settings', { ...settings, ...patch });
  const [plates, setPlates] = useState(false);

  return (
    <div className="page">
      <AccountCard />
      <section className="card">
        <h3>Football schedule</h3>
        <p className="muted small">Tempo plans your gym days around these — no heavy legs the day before or after a match, or on training days.</p>
        <DayPicker label="Match days" hint="Usually one day a week." value={settings.matchDays} onChange={(matchDays) => update({ matchDays })} />
        <DayPicker label="Training days" hint="Include days you only sometimes train." value={settings.trainingDays} onChange={(trainingDays) => update({ trainingDays })} />
      </section>
      <section className="card">
        <h3>Rest timer</h3>
        <p className="muted small">Default rest between sets during a workout. You can nudge it ±15s while it runs.</p>
        <div className="day-picker" role="radiogroup" aria-label="Rest duration">
          {[45, 60, 90, 120, 150, 180, 240].map((s) => (
            <button key={s} type="button" role="radio" aria-checked={settings.restSeconds === s}
              className={settings.restSeconds === s ? 'active' : ''} onClick={() => update({ restSeconds: s })}>
              {formatDuration(s)}
            </button>
          ))}
        </div>
      </section>
      <section className="card tools">
        <h3>Tools</h3>
        <button className="tool-row" onClick={() => setPlates(true)}><Icon name="plates" /> Plate calculator</button>
        <BackupRow />
        <a className="tool-row" href="/api/export" download><Icon name="download" /> Export data (JSON)</a>
      </section>
      <ScienceSection />
      {plates && <PlateSheet onClose={() => setPlates(false)} />}
    </div>
  );
}
