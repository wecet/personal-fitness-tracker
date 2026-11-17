import type { CSSProperties } from 'react';
import { useData } from '../data.tsx';
import { weekBeats, type BeatKind } from '../lib/week.ts';

const DESCRIBE: Record<BeatKind, string> = { gym: 'gym', football: 'football', rest: 'rest', match: 'match', training: 'football training' };

export function WeekStrip() {
  const { daily, settings, now } = useData();
  const beats = weekBeats(new Date(now), daily, settings.matchDays, settings.trainingDays);
  const label = `This week: ${beats.map((b) => `${b.name} ${b.future && b.kind !== 'rest' ? `${DESCRIBE[b.kind]} planned` : DESCRIBE[b.kind]}`).join(', ')}`;
  return (
    <div className="week-strip" role="img" aria-label={label}>
      {beats.map((b, i) => (
        <span key={i} className={`week-beat ${b.kind} ${b.today ? 'today' : ''} ${b.future ? 'future' : ''}`}>
          <span className="week-bar" style={{ '--level': b.level } as CSSProperties} />
          <span className="week-letter">{b.letter}</span>
        </span>
      ))}
    </div>
  );
}
