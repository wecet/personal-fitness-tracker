import { MUSCLE_BY_ID, isMuscleId, type MuscleId } from '../../shared/muscles.ts';
import type { Entry, Exercise, Injury, InjuryArea, InjuryContext, InjurySide, JointArea } from '../../shared/types.ts';
import { dateKey, parseDateKey } from './dates.ts';
import { startOfWeek } from './load.ts';

const DAY = 86_400_000;

export const JOINT_LABEL: Record<JointArea, string> = {
  knee: 'Knee',
  ankle: 'Ankle',
  foot: 'Foot',
  wrist: 'Wrist',
  elbow: 'Elbow',
  neck: 'Neck',
};

export const SIDE_LABEL: Record<InjurySide, string> = { left: 'Left', right: 'Right', both: 'Both sides' };

export const CONTEXT_LABEL: Record<InjuryContext, string> = { match: 'Match', training: 'Training', gym: 'Gym', other: 'Other' };

export const areaLabel = (area: InjuryArea) => (isMuscleId(area) ? (area === 'hips' ? 'Hips / groin' : MUSCLE_BY_ID[area].name) : JOINT_LABEL[area]);

/** "Left hamstrings", "Knee" */
export function injuryLabel(i: Pick<Injury, 'area' | 'side'>): string {
  const area = areaLabel(i.area);
  return i.side === 'left' || i.side === 'right' ? `${SIDE_LABEL[i.side]} ${area.toLowerCase()}` : area;
}

/** Muscles to keep load off while a joint heals. */
const JOINT_MUSCLES: Record<JointArea, MuscleId[]> = {
  knee: ['quads'],
  ankle: ['calves'],
  foot: ['calves'],
  wrist: ['forearms'],
  elbow: ['forearms'],
  neck: ['upperBack'],
};

export const areaMuscles = (area: InjuryArea): MuscleId[] => (isMuscleId(area) ? [area] : JOINT_MUSCLES[area]);

export const isActive = (i: Injury) => !i.resolvedAt;

/** Muscles affected by an ongoing injury. */
export function injuredMuscles(injuries: Injury[]): Set<MuscleId> {
  return new Set(injuries.filter(isActive).flatMap((i) => areaMuscles(i.area)));
}

export type BodySide = 'left' | 'right';

/** Which side(s) of each muscle an ongoing injury affects, for the body map. */
export function injuredSides(injuries: Injury[]): Map<MuscleId, Set<BodySide>> {
  const out = new Map<MuscleId, Set<BodySide>>();
  for (const i of injuries.filter(isActive)) {
    const sides: BodySide[] = i.side === 'left' || i.side === 'right' ? [i.side] : ['left', 'right'];
    for (const m of areaMuscles(i.area)) out.set(m, new Set([...(out.get(m) ?? []), ...sides]));
  }
  return out;
}

/** Days from injury to return (or to today while ongoing). */
export function daysOut(i: Injury, today = dateKey(new Date())): number {
  const end = i.resolvedAt ?? today;
  return Math.max(0, Math.round((parseDateKey(end).getTime() - parseDateKey(i.startedAt).getTime()) / DAY));
}

/**
 * Time-loss severity from the football injury consensus (Fuller et al., 2006,
 * Br J Sports Med 40:193–201): days until back to full training.
 */
export function severity(days: number): string {
  if (days === 0) return 'Slight';
  if (days <= 3) return 'Minimal';
  if (days <= 7) return 'Mild';
  if (days <= 28) return 'Moderate';
  return 'Severe';
}

// ---------- prevention ----------

export type ProtocolId = 'hamstring' | 'groin' | 'knee' | 'ankle';

/** When a protocol fits around football: anything, like legs work, or not within ~48h of a match (eccentric soreness). */
type Timing = 'any' | 'legs' | 'eccentric';

export interface Protocol {
  id: ProtocolId;
  name: string;
  region: string;
  /** Library names that count, or every plyometric exercise. */
  exercises: string[] | 'plyometric';
  /** Sessions per week. */
  target: number;
  /** Past injuries here make the protocol a priority. */
  areas: InjuryArea[];
  timing: Timing;
  why: string;
}

/*
 * Football-specific programmes with randomised-trial evidence. A previous
 * injury is the strongest risk factor for the next one (Hägglund et al., 2006,
 * Br J Sports Med 40:767–772; Green et al., 2020, Br J Sports Med 54:1081–1088),
 * so protocols for a region you've hurt in the last year are flagged as a priority.
 */
export const PROTOCOLS: Protocol[] = [
  {
    id: 'hamstring',
    name: 'Nordic curls',
    region: 'Hamstrings',
    exercises: ['Nordic Curl'],
    target: 2,
    areas: ['hamstrings'],
    timing: 'eccentric',
    why: 'Nordic curls roughly halve hamstring injuries in football. One or two short sessions a week keeps the effect in season.',
  },
  {
    id: 'groin',
    name: 'Copenhagen adductor',
    region: 'Groin',
    exercises: ['Copenhagen Adduction', 'Copenhagen Plank'],
    target: 2,
    areas: ['hips'],
    timing: 'eccentric',
    why: 'Footballers who added the Copenhagen adduction programme had 41% fewer groin problems over a season.',
  },
  {
    id: 'knee',
    name: 'Jumping & landing',
    region: 'Knees',
    exercises: 'plyometric',
    target: 2,
    areas: ['knee', 'quads'],
    timing: 'legs',
    why: 'Neuromuscular warm-ups with jumping, landing and balance work (like FIFA 11+) twice a week cut football injuries by around a third.',
  },
  {
    id: 'ankle',
    name: 'Balance training',
    region: 'Ankles',
    exercises: ['Single-Leg Balance'],
    target: 3,
    areas: ['ankle', 'foot', 'calves'],
    timing: 'any',
    why: 'Single-leg balance training three times a week cut repeat ankle sprains by about a third.',
  },
];

export const counts = (p: Protocol, ex: Exercise) => (p.exercises === 'plyometric' ? ex.kind === 'plyometric' : p.exercises.includes(ex.name));

export interface ProtocolStatus {
  protocol: Protocol;
  /** Distinct days done this week (Monday–Sunday). */
  done: number;
  doneToday: boolean;
  /** You've injured this region in the last 12 months. */
  priority: boolean;
  /** An ongoing injury here: rehab comes first. */
  blocked: boolean;
}

export function preventionStatus(entries: Entry[], exById: Map<number, Exercise>, injuries: Injury[], now: Date): ProtocolStatus[] {
  const weekStart = startOfWeek(now).getTime();
  const today = dateKey(now);
  const yearAgo = dateKey(new Date(now.getTime() - 365 * DAY));
  return PROTOCOLS.map((protocol) => {
    const days = new Set<string>();
    for (const e of entries) {
      const ex = exById.get(e.exerciseId);
      const at = Date.parse(e.performedAt);
      if (ex && at >= weekStart && at <= now.getTime() && counts(protocol, ex)) days.add(dateKey(e.performedAt));
    }
    const here = injuries.filter((i) => protocol.areas.includes(i.area));
    return {
      protocol,
      done: days.size,
      doneToday: days.has(today),
      priority: here.some((i) => (i.resolvedAt ?? today) >= yearAgo),
      blocked: here.some(isActive),
    };
  });
}

/** Protocols still short of their weekly target that suit today's football schedule. */
export function preventionDue(status: ProtocolStatus[], ctx: { avoidLegs: boolean; daysToMatch: number; label: string | null }): ProtocolStatus[] {
  const fits = (t: Timing) =>
    t === 'any' || (t === 'legs' ? !ctx.avoidLegs : ctx.daysToMatch > 2 && ctx.label !== 'MD+1');
  return status
    .filter((s) => s.done < s.protocol.target && !s.doneToday && !s.blocked && fits(s.protocol.timing))
    .sort((a, b) => Number(b.priority) - Number(a.priority));
}
