import type { CheckInLevel, Soreness } from '../../shared/types.ts';
import { useData, useUi } from '../data.tsx';
import { haptic } from '../lib/haptics.ts';
import { dateKey } from '../lib/dates.ts';
import { READINESS_LABEL, READINESS_NOTE } from '../lib/readiness.ts';

const QUESTIONS: { key: 'sleep' | 'energy'; label: string; answers: [string, string, string] }[] = [
  { key: 'sleep', label: 'Sleep', answers: ['Poor', 'OK', 'Good'] },
  { key: 'energy', label: 'Energy', answers: ['Low', 'OK', 'High'] },
];

/** Two taps each morning: how you slept and how you feel. Each tap saves. */
export function CheckIn() {
  const { checkIn, readiness, put } = useData();
  const { openSoreness } = useUi();
  const sore = Object.keys(checkIn?.muscles ?? {}).length;

  const answer = (key: 'sleep' | 'energy', level: CheckInLevel) => {
    haptic();
    const base: Soreness = checkIn ?? { id: `sore-${dateKey(new Date())}`, recordedAt: '', muscles: {} };
    put('soreness', { ...base, recordedAt: new Date().toISOString(), [key]: level });
  };

  return (
    <section className={`check-in ${readiness ?? ''}`} aria-label="Morning check-in">
      {QUESTIONS.map((q) => (
        <div key={q.key} className="check-row">
          <span className="check-label">{q.label}</span>
          <div className="segmented small" role="radiogroup" aria-label={q.label}>
            {q.answers.map((a, i) => {
              const level = (i + 1) as CheckInLevel;
              const on = checkIn?.[q.key] === level;
              return (
                <button key={a} type="button" role="radio" aria-checked={on} className={on ? 'active' : ''} onClick={() => answer(q.key, level)}>{a}</button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="check-foot">
        {readiness ? (
          <p className="check-verdict" aria-live="polite">
            <strong>{READINESS_LABEL[readiness]}</strong> {READINESS_NOTE[readiness]}
          </p>
        ) : (
          <p className="muted small">Answer both and today’s weights adjust to how you feel.</p>
        )}
        <button type="button" className="link" onClick={openSoreness}>{sore ? `${sore} sore` : 'Sore?'} →</button>
      </div>
    </section>
  );
}
