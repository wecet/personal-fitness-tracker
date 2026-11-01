import type { MuscleId } from '../../shared/muscles.ts';
import type { Exercise } from '../../shared/types.ts';

export type View = 'front' | 'back';

/** Where a region sits on the body figure (viewer-left half, 200×410 body coordinates). */
export interface RegionArea {
  view: View;
  /** Polygon cut out of the muscle's shape. */
  points: string;
  /** Where its number goes. */
  label: [number, number];
}

export interface Region {
  id: string;
  name: string;
  /** What trains it, in a few words. */
  hint: string;
  areas: RegionArea[];
  /** Library exercises that emphasise this region. */
  exercises: string[];
}

const area = (view: View, points: string, label: [number, number]): RegionArea => ({ view, points, label });

/*
 * Each muscle split into the parts that respond to different exercises —
 * pec heads, delt heads, quad and hamstring muscles, and so on. An exercise
 * appears under the region it emphasises most, not every region it touches.
 */
export const REGIONS: Record<MuscleId, Region[]> = {
  chest: [
    { id: 'upper', name: 'Upper chest', hint: 'Incline pressing', areas: [area('front', '55,66 102,66 102,93 55,85', [86, 86])],
      exercises: ['Incline Dumbbell Press'] },
    { id: 'mid', name: 'Mid chest', hint: 'Flat presses and flyes', areas: [area('front', '55,85 102,93 102,108 55,106', [82, 99])],
      exercises: ['Barbell Bench Press', 'Machine Chest Press', 'Cable Fly', 'Push-Up'] },
    { id: 'lower', name: 'Lower chest', hint: 'Dips and decline work', areas: [area('front', '55,106 102,108 102,130 55,130', [86, 116])],
      exercises: ['Chest Dip'] },
  ],
  shoulders: [
    { id: 'front', name: 'Front delts', hint: 'Overhead pressing', areas: [area('front', '57,64 82,64 82,126 52,126', [62, 88])],
      exercises: ['Overhead Press', 'Dumbbell Shoulder Press', 'Arnold Press'] },
    { id: 'side', name: 'Side delts', hint: 'Raises out to the side',
      areas: [area('front', '30,64 57,64 52,126 30,126', [50, 98]), area('back', '30,64 56,64 52,126 30,126', [49, 92])],
      exercises: ['Lateral Raise'] },
    { id: 'rear', name: 'Rear delts', hint: 'Reverse flyes and face pulls', areas: [area('back', '56,64 82,64 82,126 52,126', [55.5, 102])],
      exercises: ['Rear Delt Fly', 'Face Pull'] },
  ],
  biceps: [
    { id: 'long', name: 'Long head', hint: 'Curls with the arm behind you', areas: [area('front', '38,108 51.5,108 51.5,146 38,146', [47, 124])],
      exercises: ['Incline Dumbbell Curl', 'Cable Curl'] },
    { id: 'short', name: 'Short head', hint: 'Curls with the arm in front', areas: [area('front', '51.5,108 66,108 66,146 51.5,146', [56, 134])],
      exercises: ['Preacher Curl', 'Barbell Curl'] },
    { id: 'brachialis', name: 'Brachialis', hint: 'Neutral-grip curls', areas: [area('front', '38,146 66,146 66,162 38,162', [50, 151])],
      exercises: ['Hammer Curl'] },
  ],
  triceps: [
    { id: 'long', name: 'Long head', hint: 'Overhead and lying extensions', areas: [area('back', '52,94 66,94 66,160 52,160', [57, 118])],
      exercises: ['Overhead Triceps Extension', 'Skull Crusher'] },
    { id: 'lateral', name: 'Lateral & medial heads', hint: 'Pushdowns and close-grip pressing', areas: [area('back', '36,94 52,94 52,160 36,160', [47, 134])],
      exercises: ['Triceps Pushdown', 'Close-Grip Bench Press'] },
  ],
  forearms: [
    { id: 'flexors', name: 'Flexors & grip', hint: 'Palm-up wrist curls and carries', areas: [area('front', '28,150 60,150 60,216 28,216', [44, 182])],
      exercises: ['Wrist Curl', "Farmer's Carry"] },
    { id: 'extensors', name: 'Extensors', hint: 'Palm-down wrist work', areas: [area('back', '28,150 60,150 60,216 28,216', [44, 182])],
      exercises: ['Reverse Wrist Curl', 'Reverse Curl'] },
  ],
  abs: [
    { id: 'upper', name: 'Upper abs', hint: 'Crunching the ribs down', areas: [area('front', '80,120 102,120 102,166 80,166', [92, 146])],
      exercises: ['Cable Crunch', 'Ab Wheel Rollout'] },
    { id: 'lower', name: 'Lower abs', hint: 'Curling the pelvis up, bracing', areas: [area('front', '80,166 102,166 102,222 80,222', [92, 190])],
      exercises: ['Hanging Leg Raise', 'Plank'] },
  ],
  obliques: [
    { id: 'external', name: 'External obliques', hint: 'Rotation', areas: [area('front', '60,118 90,118 90,165 60,165', [75, 143])],
      exercises: ['Russian Twist', 'Cable Woodchopper'] },
    { id: 'internal', name: 'Lower obliques', hint: 'Side bending and anti-rotation', areas: [area('front', '60,165 90,165 90,212 60,212', [77, 186])],
      exercises: ['Side Plank', 'Pallof Press'] },
  ],
  upperBack: [
    { id: 'traps', name: 'Upper traps', hint: 'Shrugs', areas: [area('back', '55,44 102,44 102,74 55,79', [89, 63])],
      exercises: ['Barbell Shrug'] },
    { id: 'mid', name: 'Mid traps & rhomboids', hint: 'Rows with the elbows wide', areas: [area('back', '55,79 102,74 102,145 55,145', [93, 100])],
      exercises: ['Seated Cable Row', 'Chest-Supported Row'] },
  ],
  lats: [
    { id: 'upper', name: 'Upper lats', hint: 'Vertical pulling', areas: [area('back', '60,104 102,104 102,143 60,143', [77, 127])],
      exercises: ['Pull-Up', 'Lat Pulldown'] },
    { id: 'lower', name: 'Lower lats', hint: 'Rows and pulldowns to the hip', areas: [area('back', '60,143 102,143 102,192 60,192', [82, 166])],
      exercises: ['Barbell Row', 'Single-Arm Dumbbell Row', 'Straight-Arm Pulldown'] },
  ],
  lowerBack: [
    { id: 'erectors', name: 'Spinal erectors', hint: 'Hinging and back extensions', areas: [area('back', '76,160 102,160 102,214 76,214', [91, 192])],
      exercises: ['Deadlift', 'Back Extension', 'Good Morning'] },
  ],
  glutes: [
    { id: 'upper', name: 'Upper glutes', hint: 'Thrusts and bridges at full hip extension', areas: [area('back', '60,200 102,200 102,230 60,230', [83, 220])],
      exercises: ['Hip Thrust', 'Glute Bridge', 'Cable Kickback'] },
    { id: 'lower', name: 'Lower glutes', hint: 'Deep lunges and split squats', areas: [area('back', '60,230 102,230 102,258 60,258', [83, 243])],
      exercises: ['Bulgarian Split Squat'] },
  ],
  hips: [
    { id: 'abductors', name: 'Abductors', hint: 'Pushing the legs apart',
      areas: [area('front', '58,194 74,194 74,242 58,242', [68, 214]), area('back', '58,188 102,188 102,212 58,212', [80, 202])],
      exercises: ['Lateral Band Walk', 'Hip Abduction Machine'] },
    { id: 'flexors', name: 'Hip flexors', hint: 'Lifting the knee', areas: [area('front', '74,204 102,204 102,234 74,226', [87, 224])],
      exercises: ['Cable Hip Flexion'] },
    { id: 'adductors', name: 'Adductors', hint: 'Squeezing the legs together', areas: [area('front', '74,226 102,234 102,276 74,276', [91, 250])],
      exercises: ['Hip Adduction Machine', 'Copenhagen Adduction', 'Copenhagen Plank', 'Cossack Squat'] },
  ],
  quads: [
    { id: 'outer', name: 'Outer quad', hint: 'Vastus lateralis · squats and leg press', areas: [area('front', '58,206 76,206 76,312 58,312', [72, 238])],
      exercises: ['Back Squat', 'Hack Squat', 'Leg Press'] },
    { id: 'rectus', name: 'Rectus femoris', hint: 'Leg extensions', areas: [area('front', '76,206 85,206 85,312 76,312', [80.5, 262])],
      exercises: ['Leg Extension'] },
    { id: 'inner', name: 'Inner quad', hint: 'Vastus medialis · deep knee bend', areas: [area('front', '85,206 100,206 100,312 85,312', [89, 289])],
      exercises: ['Front Squat', 'Walking Lunge'] },
  ],
  hamstrings: [
    { id: 'outer', name: 'Outer hamstring', hint: 'Biceps femoris · hip hinges', areas: [area('back', '60,246 82,246 82,312 60,312', [74, 268])],
      exercises: ['Romanian Deadlift', 'Single-Leg Romanian Deadlift', 'Lying Leg Curl'] },
    { id: 'inner', name: 'Inner hamstrings', hint: 'Semitendinosus · curls and Nordics', areas: [area('back', '82,246 102,246 102,312 82,312', [89, 290])],
      exercises: ['Seated Leg Curl', 'Nordic Curl'] },
  ],
  calves: [
    { id: 'gastrocnemius', name: 'Gastrocnemius', hint: 'Straight-knee calf raises', areas: [area('back', '58,322 96,322 96,358 58,358', [78, 343])],
      exercises: ['Standing Calf Raise', 'Leg Press Calf Raise'] },
    { id: 'soleus', name: 'Soleus', hint: 'Bent-knee calf raises', areas: [area('back', '58,358 96,358 96,382 58,382', [78, 366])],
      exercises: ['Seated Calf Raise'] },
  ],
};

export interface RegionGroup {
  region: Region;
  number: number;
  exercises: Exercise[];
}

/** Split a muscle's exercises (already ordered) into its numbered regions, plus whatever matches none. */
export function groupByRegion(muscle: MuscleId, exercises: Exercise[]): { groups: RegionGroup[]; other: Exercise[] } {
  const regions = REGIONS[muscle];
  const groups = regions.map((region, i) => ({ region, number: i + 1, exercises: exercises.filter((ex) => region.exercises.includes(ex.name)) }));
  const other = exercises.filter((ex) => !regions.some((r) => r.exercises.includes(ex.name)));
  return { groups, other };
}
