import type { MuscleId } from './muscles.ts';
import type { ExerciseKind, ExerciseMetric } from './types.ts';

/** [name, primary muscle, secondary muscles, metric, kind] — seeded into the database on startup. */
export const EXERCISE_LIBRARY: [string, MuscleId, MuscleId[], ExerciseMetric?, ExerciseKind?][] = [
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
  ['Copenhagen Adduction', 'hips', ['obliques', 'abs'], 'bodyweight'],
  ['Copenhagen Plank', 'hips', ['obliques', 'abs'], 'time'],
  ['Lateral Band Walk', 'hips', ['glutes'], 'bodyweight'],
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
  ['Single-Leg Romanian Deadlift', 'hamstrings', ['glutes', 'lowerBack']],

  ['Standing Calf Raise', 'calves', []],
  ['Seated Calf Raise', 'calves', []],
  ['Leg Press Calf Raise', 'calves', []],

  // Plyometrics: reps are ground contacts (or throws).
  ['Pogo Hops', 'calves', ['quads'], 'bodyweight', 'plyometric'],
  ['Squat Jump', 'quads', ['glutes', 'calves'], 'bodyweight', 'plyometric'],
  ['Box Jump', 'quads', ['glutes', 'calves'], 'bodyweight', 'plyometric'],
  ['Broad Jump', 'glutes', ['quads', 'hamstrings', 'calves'], 'bodyweight', 'plyometric'],
  ['Lateral Bound', 'glutes', ['hips', 'quads', 'calves'], 'bodyweight', 'plyometric'],
  ['Tuck Jump', 'quads', ['abs', 'calves'], 'bodyweight', 'plyometric'],
  ['Hurdle Hop', 'calves', ['quads', 'glutes'], 'bodyweight', 'plyometric'],
  ['Single-Leg Hop', 'quads', ['calves', 'glutes'], 'bodyweight', 'plyometric'],
  ['Bounding', 'glutes', ['hamstrings', 'calves', 'hips'], 'bodyweight', 'plyometric'],
  ['Depth Jump', 'quads', ['calves', 'glutes'], 'bodyweight', 'plyometric'],
  ['Plyo Push-Up', 'chest', ['triceps', 'shoulders'], 'bodyweight', 'plyometric'],
  ['Medicine Ball Slam', 'abs', ['lats', 'shoulders'], 'weight', 'plyometric'],
  ['Medicine Ball Rotational Throw', 'obliques', ['abs', 'shoulders'], 'weight', 'plyometric'],

  // Mobility, stretching and low-load activation: logged, but adds no fatigue.
  ['Dead Bug', 'abs', ['obliques'], 'bodyweight', 'mobility'],
  ['Bird Dog', 'lowerBack', ['glutes', 'abs'], 'bodyweight', 'mobility'],
  ['Cat-Cow', 'lowerBack', ['abs'], 'bodyweight', 'mobility'],
  ['Single-Leg Balance', 'calves', ['hips'], 'time', 'mobility'],
  ['Hamstring Stretch', 'hamstrings', [], 'time', 'mobility'],
  ['Couch Stretch', 'hips', ['quads'], 'time', 'mobility'],
  ['Quad Stretch', 'quads', [], 'time', 'mobility'],
  ['Pigeon Stretch', 'glutes', ['hips'], 'time', 'mobility'],
  ['90/90 Hip Switch', 'hips', ['glutes'], 'bodyweight', 'mobility'],
  ["World's Greatest Stretch", 'hips', ['hamstrings', 'upperBack'], 'bodyweight', 'mobility'],
  ['Adductor Rock-Back', 'hips', [], 'bodyweight', 'mobility'],
  ['Calf Stretch', 'calves', [], 'time', 'mobility'],
  ['Knee-to-Wall Ankle Mobility', 'calves', [], 'bodyweight', 'mobility'],
  ['Thoracic Open Book', 'upperBack', ['obliques'], 'bodyweight', 'mobility'],
  ['Doorway Pec Stretch', 'chest', ['shoulders'], 'time', 'mobility'],
  ['Cross-Body Shoulder Stretch', 'shoulders', [], 'time', 'mobility'],
  ["Child's Pose", 'lats', ['lowerBack'], 'time', 'mobility'],
];
