import type { Exercise } from '@muscleos/types';

/** Extensive exercise catalog. IDs are used in workout templates. */
export const EXERCISES: Exercise[] = [
  { id: 'bench-press', name: 'Barbell Bench Press', muscles: ['chest', 'front_delts', 'triceps'], equipment: ['barbell'], instructions: 'Lie on bench, grip slightly wider than shoulders, lower bar to chest, press up.' },
  { id: 'incline-bench', name: 'Incline Barbell Bench Press', muscles: ['chest', 'front_delts', 'triceps'], equipment: ['barbell'], instructions: 'Set bench to 30-45°, same as flat bench.' },
  { id: 'dumbbell-fly', name: 'Dumbbell Fly', muscles: ['chest'], equipment: ['dumbbell'], instructions: 'Arcs out to sides, slight bend in elbows.' },
  { id: 'push-up', name: 'Push-up', muscles: ['chest', 'front_delts', 'triceps'], equipment: ['bodyweight'] },
  { id: 'overhead-press', name: 'Overhead Press', muscles: ['front_delts', 'side_delts', 'triceps'], equipment: ['barbell'] },
  { id: 'dumbbell-ohp', name: 'Dumbbell Shoulder Press', muscles: ['front_delts', 'side_delts', 'triceps'], equipment: ['dumbbell'] },
  { id: 'lateral-raise', name: 'Lateral Raise', muscles: ['side_delts'], equipment: ['dumbbell'] },
  { id: 'front-raise', name: 'Front Raise', muscles: ['front_delts'], equipment: ['dumbbell'] },
  { id: 'face-pull', name: 'Face Pull', muscles: ['rear_delts', 'traps', 'rhomboids'], equipment: ['cable'] },
  { id: 'tricep-pushdown', name: 'Tricep Pushdown', muscles: ['triceps'], equipment: ['cable'] },
  { id: 'tricep-dips', name: 'Tricep Dips', muscles: ['triceps', 'chest', 'front_delts'], equipment: ['bodyweight'] },
  { id: 'skull-crusher', name: 'Skull Crusher', muscles: ['triceps'], equipment: ['ez_bar'] },
  { id: 'barbell-row', name: 'Barbell Row', muscles: ['lats', 'rhomboids', 'biceps', 'lower_back'], equipment: ['barbell'] },
  { id: 'pull-up', name: 'Pull-up', muscles: ['lats', 'biceps'], equipment: ['bodyweight'] },
  { id: 'lat-pulldown', name: 'Lat Pulldown', muscles: ['lats', 'biceps'], equipment: ['cable'] },
  { id: 'seated-row', name: 'Seated Cable Row', muscles: ['lats', 'rhomboids', 'biceps'], equipment: ['cable'] },
  { id: 'deadlift', name: 'Deadlift', muscles: ['lower_back', 'hamstrings', 'glutes', 'traps', 'forearms'], equipment: ['barbell'] },
  { id: 'romanian-deadlift', name: 'Romanian Deadlift', muscles: ['hamstrings', 'glutes', 'lower_back'], equipment: ['barbell'] },
  { id: 'barbell-curl', name: 'Barbell Curl', muscles: ['biceps'], equipment: ['barbell'] },
  { id: 'hammer-curl', name: 'Hammer Curl', muscles: ['biceps', 'forearms'], equipment: ['dumbbell'] },
  { id: 'preacher-curl', name: 'Preacher Curl', muscles: ['biceps'], equipment: ['barbell', 'ez_bar'] },
  { id: 'squat', name: 'Barbell Squat', muscles: ['quads', 'glutes', 'hamstrings'], equipment: ['barbell'] },
  { id: 'leg-press', name: 'Leg Press', muscles: ['quads', 'glutes'], equipment: ['machine'] },
  { id: 'leg-extension', name: 'Leg Extension', muscles: ['quads'], equipment: ['machine'] },
  { id: 'leg-curl', name: 'Leg Curl', muscles: ['hamstrings'], equipment: ['machine'] },
  { id: 'lunges', name: 'Lunges', muscles: ['quads', 'glutes', 'hamstrings'], equipment: ['dumbbell', 'bodyweight'] },
  { id: 'calf-raise', name: 'Calf Raise', muscles: ['calves'], equipment: ['machine', 'dumbbell'] },
  { id: 'hip-thrust', name: 'Hip Thrust', muscles: ['glutes', 'hamstrings'], equipment: ['barbell'] },
  { id: 'plank', name: 'Plank', muscles: ['abs'], equipment: ['bodyweight'] },
  { id: 'crunch', name: 'Crunch', muscles: ['abs'], equipment: ['bodyweight'] },
  { id: 'cable-crunch', name: 'Cable Crunch', muscles: ['abs'], equipment: ['cable'] },
  { id: 'side-bend', name: 'Side Bend', muscles: ['obliques'], equipment: ['dumbbell'] },
  { id: 'back-extension', name: 'Back Extension', muscles: ['lower_back', 'glutes'], equipment: ['bodyweight', 'machine'] },
  { id: 'shrug', name: 'Barbell Shrug', muscles: ['traps'], equipment: ['barbell'] },
  { id: 'upright-row', name: 'Upright Row', muscles: ['traps', 'side_delts', 'biceps'], equipment: ['barbell', 'dumbbell'] },
  { id: 'arnold-press', name: 'Arnold Press', muscles: ['front_delts', 'side_delts', 'triceps'], equipment: ['dumbbell'] },
  { id: 'close-grip-bench', name: 'Close Grip Bench Press', muscles: ['triceps', 'chest'], equipment: ['barbell'] },
  { id: 'chinups', name: 'Chin-ups', muscles: ['lats', 'biceps'], equipment: ['bodyweight'] },
  { id: 't-bar-row', name: 'T-Bar Row', muscles: ['lats', 'rhomboids', 'biceps'], equipment: ['barbell'] },
  { id: 'hack-squat', name: 'Hack Squat', muscles: ['quads', 'glutes'], equipment: ['machine'] },
  { id: 'bulgarian-split', name: 'Bulgarian Split Squat', muscles: ['quads', 'glutes', 'hamstrings'], equipment: ['dumbbell'] },
  { id: 'goblet-squat', name: 'Goblet Squat', muscles: ['quads', 'glutes', 'abs'], equipment: ['dumbbell', 'kettlebell'] },
  { id: 'cable-fly', name: 'Cable Fly', muscles: ['chest'], equipment: ['cable'] },
  { id: 'reverse-fly', name: 'Reverse Fly', muscles: ['rear_delts', 'rhomboids'], equipment: ['dumbbell', 'cable'] },
  { id: 'wrist-curl', name: 'Wrist Curl', muscles: ['forearms'], equipment: ['dumbbell', 'barbell'] },
  { id: 'reverse-wrist-curl', name: 'Reverse Wrist Curl', muscles: ['forearms'], equipment: ['dumbbell'] },
];

export const EXERCISE_MAP = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise | undefined {
  return EXERCISE_MAP.get(id);
}
