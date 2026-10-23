import type { MuscleId } from './muscles.ts';
import type { ExerciseMetric } from './types.ts';

/** [name, primary muscle, secondary muscles, metric] — seeded into the database on startup. */
export const EXERCISE_LIBRARY: [string, MuscleId, MuscleId[], ExerciseMetric?][] = [
  ['Barbell Bench Press', 'chest', ['triceps', 'shoulders']],
  ['Incline Dumbbell Press', 'chest', ['shoulders', 'triceps']],
  ['Machine Chest Press', 'chest', ['triceps']],
  ['Cable Fly', 'chest', []],
  ['Chest Dip', 'chest', ['triceps', 'shoulders'], 'bodyweight'],
  ['Push-Up', 'chest', ['triceps', 'shoulders', 'abs'], 'bodyweight'],

  ['Overhead Press', 'shoulders', ['triceps', 'upperBack']],
  ['Dumbbell Shoulder Press', 'shoulders', ['triceps']],
  ['Arnold Press', 'shoulders', ['triceps']],
  ['Lateral Raise', 'shoulders', []],
  ['Rear Delt Fly', 'shoulders', ['upperBack']],
  ['Face Pull', 'shoulders', ['upperBack']],

  ['Barbell Curl', 'biceps', ['forearms']],
  ['Preacher Curl', 'biceps', []],
  ['Incline Dumbbell Curl', 'biceps', []],
  ['Hammer Curl', 'biceps', ['forearms']],
  ['Cable Curl', 'biceps', []],

  ['Triceps Pushdown', 'triceps', []],
  ['Overhead Triceps Extension', 'triceps', []],
  ['Skull Crusher', 'triceps', []],
  ['Close-Grip Bench Press', 'triceps', ['chest', 'shoulders']],

  ['Wrist Curl', 'forearms', []],
  ['Reverse Wrist Curl', 'forearms', []],
  ['Reverse Curl', 'forearms', ['biceps']],
  ["Farmer's Carry", 'forearms', ['upperBack', 'abs'], 'time'],

  ['Cable Crunch', 'abs', []],
  ['Hanging Leg Raise', 'abs', ['hips'], 'bodyweight'],
  ['Ab Wheel Rollout', 'abs', ['lats'], 'bodyweight'],
  ['Plank', 'abs', ['obliques'], 'time'],

  ['Russian Twist', 'obliques', ['abs'], 'bodyweight'],
  ['Cable Woodchopper', 'obliques', ['abs']],
  ['Side Plank', 'obliques', ['abs'], 'time'],
  ['Pallof Press', 'obliques', ['abs']],

  ['Barbell Shrug', 'upperBack', ['forearms']],
  ['Seated Cable Row', 'upperBack', ['lats', 'biceps']],
  ['Chest-Supported Row', 'upperBack', ['lats', 'biceps', 'shoulders']],

  ['Pull-Up', 'lats', ['biceps', 'upperBack'], 'bodyweight'],
  ['Lat Pulldown', 'lats', ['biceps', 'upperBack']],
  ['Barbell Row', 'lats', ['upperBack', 'biceps', 'lowerBack']],
  ['Single-Arm Dumbbell Row', 'lats', ['upperBack', 'biceps']],
  ['Straight-Arm Pulldown', 'lats', []],

  ['Deadlift', 'lowerBack', ['hamstrings', 'glutes', 'upperBack', 'forearms']],
  ['Back Extension', 'lowerBack', ['glutes', 'hamstrings']],
  ['Good Morning', 'lowerBack', ['hamstrings', 'glutes']],

  ['Hip Thrust', 'glutes', ['hamstrings']],
  ['Glute Bridge', 'glutes', ['hamstrings']],
  ['Bulgarian Split Squat', 'glutes', ['quads', 'hips']],
  ['Cable Kickback', 'glutes', []],

  ['Hip Adduction Machine', 'hips', []],
  ['Hip Abduction Machine', 'hips', ['glutes']],
  ['Cossack Squat', 'hips', ['quads', 'glutes'], 'bodyweight'],
  ['Cable Hip Flexion', 'hips', ['abs']],

  ['Back Squat', 'quads', ['glutes', 'hips', 'lowerBack']],
  ['Front Squat', 'quads', ['glutes', 'abs']],
  ['Hack Squat', 'quads', ['glutes']],
  ['Leg Press', 'quads', ['glutes']],
  ['Leg Extension', 'quads', []],
  ['Walking Lunge', 'quads', ['glutes', 'hamstrings']],

  ['Romanian Deadlift', 'hamstrings', ['glutes', 'lowerBack']],
  ['Lying Leg Curl', 'hamstrings', []],
  ['Seated Leg Curl', 'hamstrings', []],
  ['Nordic Curl', 'hamstrings', [], 'bodyweight'],

  ['Standing Calf Raise', 'calves', []],
  ['Seated Calf Raise', 'calves', []],
  ['Leg Press Calf Raise', 'calves', []],
];
