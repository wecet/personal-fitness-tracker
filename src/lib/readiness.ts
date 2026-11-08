import type { CheckInLevel, Soreness } from '../../shared/types.ts';
import type { LoadZone } from './load.ts';

/*
 * A one-tap morning check-in turned into a call for the day. Self-reported sleep,
 * energy and soreness track training readiness at least as well as heart-rate
 * measures (Saw, Main & Gastin, 2016, "Monitoring the athlete training response:
 * subjective self-reported measures trump commonly used objective measures",
 * Br J Sports Med 50:281–291). How the call changes the day's weights is in
 * forReadiness (progression.ts).
 */

export type Readiness = 'push' | 'hold' | 'ease';

export const READINESS_LABEL: Record<Readiness, string> = { push: 'Push', hold: 'Hold steady', ease: 'Ease off' };

export const READINESS_NOTE: Record<Readiness, string> = {
  push: 'You’re good to go — aim to beat last time.',
  hold: 'Repeat last time’s weights rather than going up.',
  ease: 'Go about 10% lighter with one set fewer.',
};

export interface ReadinessInput {
  /** Today's check-in, if there is one. */
  checkIn: Soreness | undefined;
  loadZone?: LoadZone;
  /** The day after a match. */
  matchYesterday?: boolean;
}

/** Each answer counts −1 (poor), 0 (OK) or +1 (good). */
const score = (level: CheckInLevel | undefined) => (level == null ? 0 : level - 2);

/** null until today's sleep and energy are both answered. */
export function readiness({ checkIn, loadZone, matchYesterday }: ReadinessInput): Readiness | null {
  if (!checkIn?.sleep || !checkIn.energy) return null;
  const sore = Object.values(checkIn.muscles);
  let total = score(checkIn.sleep) + score(checkIn.energy);
  if (sore.includes(2) || sore.length >= 3) total -= 1;
  if (loadZone === 'spike') total -= 1;
  if (matchYesterday) total -= 1;
  return total >= 0 ? 'push' : total === -1 ? 'hold' : 'ease';
}
