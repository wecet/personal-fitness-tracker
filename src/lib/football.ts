import type { MuscleId } from '../../shared/muscles.ts';
import type { Activity, FootballType, Settings } from '../../shared/types.ts';
import { dateKey } from './dates.ts';

export const FOOTBALL_LABEL: Record<FootballType, string> = {
  match: 'Match',
  training: 'Training',
  futsal: 'Futsal',
  drills: 'Solo drills',
};

export const DEFAULT_MINUTES: Record<FootballType, number> = { match: 90, training: 75, futsal: 50, drills: 45 };

export const EFFORT_LABEL = ['', 'Very easy', 'Easy', 'Light', 'Moderate', 'Steady', 'Hard', 'Very hard', 'Tough', 'Brutal', 'Left everything out there'];

/**
 * Share of a session's load each muscle takes. Sprinting and changes of
 * direction load the hamstrings and adductors (hips) most, then calves and
 * quads (decelerations); trunk work is light.
 */
export const FOOTBALL_MUSCLES: [MuscleId, number][] = [
  ['hamstrings', 1],
  ['hips', 1],
  ['calves', 0.9],
  ['quads', 0.9],
  ['glutes', 0.7],
  ['obliques', 0.3],
  ['abs', 0.3],
];

/** Session-RPE training load in arbitrary units: minutes × effort. */
export const activityLoad = (a: Pick<Activity, 'minutes' | 'rpe'>) => a.minutes * a.rpe;


export interface FootballContext {
  /** Short label for the day relative to the match, e.g. "Match day", "MD-1". */
  label: string | null;
  note: string | null;
  /** Today is a match: suggest rest rather than lifting. */
  restDay: boolean;
  avoidLegs: boolean;
  /** Far enough from the next match for heavy lower-body work. */
  legsWindow: boolean;
  /** 0 on match day; Infinity without a match schedule. */
  daysToMatch: number;
}

export function footballContext(now: Date, settings: Settings, activities: Activity[]): FootballContext {
  const d = now.getDay();
  const yesterdayKey = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const playedYesterday = activities.some((a) => a.type === 'match' && dateKey(a.performedAt) === yesterdayKey);
  const daysToMatch = settings.matchDays.length ? Math.min(...settings.matchDays.map((m) => (m - d + 7) % 7)) : Infinity;
  const matchYesterday = settings.matchDays.includes((d + 6) % 7) || playedYesterday;
  const training = settings.trainingDays.includes(d);
  const none: FootballContext = { label: null, note: null, restDay: false, avoidLegs: false, legsWindow: false, daysToMatch };

  if (daysToMatch === 0) return { ...none, label: 'Match day', note: 'Match day — save your legs and log the game afterwards.', restDay: true, avoidLegs: true };
  if (daysToMatch === 1) return { ...none, label: 'MD-1', note: 'Match tomorrow — keep your legs fresh. Upper body or rest.', avoidLegs: true };
  if (matchYesterday) return { ...none, label: 'MD+1', note: 'Day after the match — recover. Upper body or mobility only.', avoidLegs: true };
  if (training) return { ...none, label: 'Football training', note: 'Football training today — skip heavy legs; upper body if you lift.', avoidLegs: true };
  if (daysToMatch === 2) return { ...none, label: 'MD-2', note: 'Two days to the match — keep leg work light.', avoidLegs: true };
  if (daysToMatch <= 6) return { ...none, label: `MD-${daysToMatch}`, note: `Good window for heavy legs — ${daysToMatch} days until the match.`, legsWindow: true };
  return none;
}
