import type { WorkoutTemplate, TemplateFolder } from '@muscleos/types';

/** Built-in folder groups. Not stored; used to organize built-in templates in the UI. */
export const BUILT_IN_FOLDERS: TemplateFolder[] = [
  { id: 'builtin_ppl', name: 'Push Pull Legs' },
  { id: 'builtin_ul', name: 'Upper Lower Splits' },
  { id: 'builtin_sl', name: 'Strong Lifts 5x5' },
  { id: 'builtin_phul', name: 'PHUL' },
];

/** Built-in workout templates. Not stored; merged with user templates in UI. */
export const BUILT_IN_TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'ppl-push',
    name: 'Push',
    isBuiltIn: true,
    folderId: 'builtin_ppl',
    exerciseIds: ['bench-press', 'overhead-press', 'incline-bench', 'lateral-raise', 'tricep-pushdown', 'skull-crusher'],
  },
  {
    id: 'ppl-pull',
    name: 'Pull',
    isBuiltIn: true,
    folderId: 'builtin_ppl',
    exerciseIds: ['barbell-row', 'pull-up', 'lat-pulldown', 'face-pull', 'barbell-curl', 'hammer-curl'],
  },
  {
    id: 'ppl-legs',
    name: 'Legs',
    isBuiltIn: true,
    folderId: 'builtin_ppl',
    exerciseIds: ['squat', 'romanian-deadlift', 'leg-press', 'leg-curl', 'calf-raise', 'plank'],
  },
  {
    id: 'ul-upper-a',
    name: 'Upper A',
    description: 'Horizontal push and pull. Alternate with Lower A.',
    isBuiltIn: true,
    folderId: 'builtin_ul',
    exerciseIds: ['bench-press', 'barbell-row', 'overhead-press', 'lat-pulldown', 'lateral-raise', 'tricep-pushdown'],
  },
  {
    id: 'ul-lower-a',
    name: 'Lower A',
    description: 'Squat-focused. Alternate with Upper A.',
    isBuiltIn: true,
    folderId: 'builtin_ul',
    exerciseIds: ['squat', 'romanian-deadlift', 'leg-press', 'leg-curl', 'calf-raise', 'plank'],
  },
  {
    id: 'ul-upper-b',
    name: 'Upper B',
    description: 'Vertical pull and incline press. Alternate with Lower B.',
    isBuiltIn: true,
    folderId: 'builtin_ul',
    exerciseIds: ['incline-bench', 'seated-row', 'pull-up', 'face-pull', 'hammer-curl', 'skull-crusher'],
  },
  {
    id: 'ul-lower-b',
    name: 'Lower B',
    description: 'Hinge-focused. Alternate with Upper B.',
    isBuiltIn: true,
    folderId: 'builtin_ul',
    exerciseIds: ['deadlift', 'bulgarian-split', 'hip-thrust', 'leg-extension', 'leg-curl', 'calf-raise'],
  },
  {
    id: 'sl-a',
    name: 'Workout A',
    description: '5 sets of 5 reps. Alternating with B.',
    isBuiltIn: true,
    folderId: 'builtin_sl',
    exerciseIds: ['squat', 'bench-press', 'barbell-row'],
    exercises: [
      { exerciseId: 'squat', sets: 5 },
      { exerciseId: 'bench-press', sets: 5 },
      { exerciseId: 'barbell-row', sets: 5 },
    ],
  },
  {
    id: 'sl-b',
    name: 'Workout B',
    description: '5 sets of 5 reps. Alternating with A.',
    isBuiltIn: true,
    folderId: 'builtin_sl',
    exerciseIds: ['squat', 'overhead-press', 'deadlift'],
    exercises: [
      { exerciseId: 'squat', sets: 5 },
      { exerciseId: 'overhead-press', sets: 5 },
      { exerciseId: 'deadlift', sets: 5 },
    ],
  },
  {
    id: 'phul-upper-power',
    name: 'Upper Power',
    description: 'Heavy compounds for 3–5 reps, accessories for 6–10. Day 1 of PHUL.',
    isBuiltIn: true,
    folderId: 'builtin_phul',
    exerciseIds: ['bench-press', 'dumbbell-incline-press', 'barbell-row', 'lat-pulldown', 'overhead-press', 'barbell-curl', 'skull-crusher'],
    exercises: [
      { exerciseId: 'bench-press', sets: 4 },
      { exerciseId: 'dumbbell-incline-press', sets: 3 },
      { exerciseId: 'barbell-row', sets: 4 },
      { exerciseId: 'lat-pulldown', sets: 3 },
      { exerciseId: 'overhead-press', sets: 3 },
      { exerciseId: 'barbell-curl', sets: 3 },
      { exerciseId: 'skull-crusher', sets: 3 },
    ],
  },
  {
    id: 'phul-lower-power',
    name: 'Lower Power',
    description: 'Squat and deadlift for 3–5 reps, then leg press for 10–15. Day 2 of PHUL.',
    isBuiltIn: true,
    folderId: 'builtin_phul',
    exerciseIds: ['squat', 'deadlift', 'leg-press', 'leg-curl', 'calf-raise'],
    exercises: [
      { exerciseId: 'squat', sets: 4 },
      { exerciseId: 'deadlift', sets: 4 },
      { exerciseId: 'leg-press', sets: 4 },
      { exerciseId: 'leg-curl', sets: 3 },
      { exerciseId: 'calf-raise', sets: 4 },
    ],
  },
  {
    id: 'phul-upper-hypertrophy',
    name: 'Upper Hypertrophy',
    description: 'Moderate weight for 8–12 reps. Day 3 of PHUL.',
    isBuiltIn: true,
    folderId: 'builtin_phul',
    exerciseIds: ['incline-bench', 'dumbbell-fly', 'seated-row', 'dumbbell-row', 'lateral-raise', 'incline-dumbbell-curl', 'tricep-pushdown'],
    exercises: [
      { exerciseId: 'incline-bench', sets: 4 },
      { exerciseId: 'dumbbell-fly', sets: 3 },
      { exerciseId: 'seated-row', sets: 4 },
      { exerciseId: 'dumbbell-row', sets: 3 },
      { exerciseId: 'lateral-raise', sets: 3 },
      { exerciseId: 'incline-dumbbell-curl', sets: 3 },
      { exerciseId: 'tricep-pushdown', sets: 3 },
    ],
  },
  {
    id: 'phul-lower-hypertrophy',
    name: 'Lower Hypertrophy',
    description: 'Moderate weight for 8–15 reps. Day 4 of PHUL.',
    isBuiltIn: true,
    folderId: 'builtin_phul',
    exerciseIds: ['front-squat', 'barbell-lunge', 'leg-extension', 'leg-curl', 'seated-calf-raise', 'calf-raise-in-leg-press'],
    exercises: [
      { exerciseId: 'front-squat', sets: 4 },
      { exerciseId: 'barbell-lunge', sets: 3 },
      { exerciseId: 'leg-extension', sets: 3 },
      { exerciseId: 'leg-curl', sets: 3 },
      { exerciseId: 'seated-calf-raise', sets: 4 },
      { exerciseId: 'calf-raise-in-leg-press', sets: 3 },
    ],
  },
];

export const BUILT_IN_TEMPLATE_MAP = new Map(BUILT_IN_TEMPLATES.map((t) => [t.id, t]));

/**
 * A built-in program: one shipped folder of templates plus the facts the Programs screen shows.
 * At most one program is in Your workouts at a time (`activeProgramId` in app settings).
 */
export interface BuiltInProgram {
  /** The built-in folder id (`builtin_ppl`). */
  id: string;
  name: string;
  summary: string;
  daysPerWeek: string;
  level: 'Beginner' | 'Intermediate';
}

/** Programs in the order the Programs screen lists them. */
export const BUILT_IN_PROGRAMS: BuiltInProgram[] = [
  {
    id: 'builtin_sl',
    name: 'Strong Lifts 5x5',
    summary: 'Three big lifts, five sets of five. Alternate Workout A and B.',
    daysPerWeek: '3',
    level: 'Beginner',
  },
  {
    id: 'builtin_ppl',
    name: 'Push Pull Legs',
    summary: 'Split by movement. Run it once or twice a week.',
    daysPerWeek: '3–6',
    level: 'Beginner',
  },
  {
    id: 'builtin_ul',
    name: 'Upper Lower Splits',
    summary: 'Two upper and two lower days, each pair with a different focus.',
    daysPerWeek: '4',
    level: 'Intermediate',
  },
  {
    id: 'builtin_phul',
    name: 'PHUL',
    summary: 'Power Hypertrophy Upper Lower: heavy power days, then lighter volume days.',
    daysPerWeek: '4',
    level: 'Intermediate',
  },
];

export function isBuiltInProgramId(id: string): boolean {
  return BUILT_IN_PROGRAMS.some((p) => p.id === id);
}

export function builtInProgram(id: string | null | undefined): BuiltInProgram | undefined {
  return id == null ? undefined : BUILT_IN_PROGRAMS.find((p) => p.id === id);
}

/** A program's templates, in their shipped order. */
export function programTemplates(programId: string): WorkoutTemplate[] {
  return BUILT_IN_TEMPLATES.filter((t) => t.folderId === programId);
}
