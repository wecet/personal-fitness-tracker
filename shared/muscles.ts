export type MuscleId =
  | 'shoulders'
  | 'chest'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'upperBack'
  | 'lats'
  | 'lowerBack'
  | 'glutes'
  | 'hips'
  | 'quads'
  | 'hamstrings'
  | 'calves';

export type MuscleCategory = 'push' | 'pull' | 'legs' | 'core';

export interface MuscleInfo {
  id: MuscleId;
  name: string;
  category: MuscleCategory;
  /** Recommended rest before training this muscle hard again. */
  recoveryHours: number;
}

export const MUSCLES: MuscleInfo[] = [
  { id: 'chest', name: 'Chest', category: 'push', recoveryHours: 72 },
  { id: 'shoulders', name: 'Shoulders', category: 'push', recoveryHours: 48 },
  { id: 'triceps', name: 'Triceps', category: 'push', recoveryHours: 48 },
  { id: 'upperBack', name: 'Upper Back', category: 'pull', recoveryHours: 60 },
  { id: 'lats', name: 'Lats', category: 'pull', recoveryHours: 72 },
  { id: 'lowerBack', name: 'Lower Back', category: 'pull', recoveryHours: 72 },
  { id: 'biceps', name: 'Biceps', category: 'pull', recoveryHours: 48 },
  { id: 'forearms', name: 'Forearms', category: 'pull', recoveryHours: 36 },
  { id: 'abs', name: 'Abs', category: 'core', recoveryHours: 36 },
  { id: 'obliques', name: 'Obliques', category: 'core', recoveryHours: 36 },
  { id: 'glutes', name: 'Glutes', category: 'legs', recoveryHours: 72 },
  { id: 'hips', name: 'Hips', category: 'legs', recoveryHours: 48 },
  { id: 'quads', name: 'Quads', category: 'legs', recoveryHours: 72 },
  { id: 'hamstrings', name: 'Hamstrings', category: 'legs', recoveryHours: 72 },
  { id: 'calves', name: 'Calves', category: 'legs', recoveryHours: 48 },
];

export const MUSCLE_BY_ID = Object.fromEntries(MUSCLES.map((m) => [m.id, m])) as Record<MuscleId, MuscleInfo>;

export const MUSCLE_IDS = MUSCLES.map((m) => m.id);

export function isMuscleId(value: unknown): value is MuscleId {
  return typeof value === 'string' && value in MUSCLE_BY_ID;
}
