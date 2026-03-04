import type { WorkoutTemplate, TemplateFolder } from '@muscleos/types';

/** Built-in folder groups. Not stored; used to organize built-in templates in the UI. */
export const BUILT_IN_FOLDERS: TemplateFolder[] = [
  { id: 'builtin_ppl', name: 'Push Pull Legs' },
  { id: 'builtin_ul', name: 'Upper Lower' },
  { id: 'builtin_sl', name: 'Strong Lifts 5x5' },
  { id: 'builtin_arnold', name: 'Arnold Split' },
];

/** Built-in workout templates. Not stored; merged with user templates in UI. */
export const BUILT_IN_TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'ppl-push',
    name: 'Push',
    description: 'Chest, shoulders, triceps.',
    isBuiltIn: true,
    folderId: 'builtin_ppl',
    exerciseIds: ['bench-press', 'overhead-press', 'incline-bench', 'lateral-raise', 'tricep-pushdown', 'skull-crusher'],
  },
  {
    id: 'ppl-pull',
    name: 'Pull',
    description: 'Back, biceps.',
    isBuiltIn: true,
    folderId: 'builtin_ppl',
    exerciseIds: ['barbell-row', 'pull-up', 'lat-pulldown', 'face-pull', 'barbell-curl', 'hammer-curl'],
  },
  {
    id: 'ppl-legs',
    name: 'Legs',
    description: 'Quads, hamstrings, calves.',
    isBuiltIn: true,
    folderId: 'builtin_ppl',
    exerciseIds: ['squat', 'romanian-deadlift', 'leg-press', 'leg-curl', 'calf-raise', 'plank'],
  },
  {
    id: 'ul-upper-a',
    name: 'Upper A',
    description: 'From Upper Lower 4-day split.',
    isBuiltIn: true,
    folderId: 'builtin_ul',
    exerciseIds: ['bench-press', 'barbell-row', 'overhead-press', 'lat-pulldown', 'tricep-pushdown', 'barbell-curl'],
  },
  {
    id: 'ul-lower-a',
    name: 'Lower A',
    description: 'From Upper Lower 4-day split.',
    isBuiltIn: true,
    folderId: 'builtin_ul',
    exerciseIds: ['squat', 'romanian-deadlift', 'leg-press', 'leg-curl', 'calf-raise', 'plank'],
  },
  {
    id: 'ul-upper-b',
    name: 'Upper B',
    description: 'From Upper Lower 4-day split.',
    isBuiltIn: true,
    folderId: 'builtin_ul',
    exerciseIds: ['incline-bench', 'seated-row', 'dumbbell-ohp', 'pull-up', 'skull-crusher', 'hammer-curl'],
  },
  {
    id: 'ul-lower-b',
    name: 'Lower B',
    description: 'From Upper Lower 4-day split.',
    isBuiltIn: true,
    folderId: 'builtin_ul',
    exerciseIds: ['deadlift', 'leg-extension', 'hip-thrust', 'lunges', 'calf-raise', 'back-extension'],
  },
  {
    id: 'sl-a',
    name: 'Workout A',
    description: '5 sets of 5 reps. Alternating with B.',
    isBuiltIn: true,
    folderId: 'builtin_sl',
    exerciseIds: ['squat', 'bench-press', 'barbell-row'],
    defaultSets: 5,
  },
  {
    id: 'sl-b',
    name: 'Workout B',
    description: '5 sets of 5 reps. Alternating with A.',
    isBuiltIn: true,
    folderId: 'builtin_sl',
    exerciseIds: ['squat', 'overhead-press', 'deadlift'],
    defaultSets: 5,
  },
  {
    id: 'arnold-chest-back',
    name: 'Chest & Back',
    description: 'From Arnold Split.',
    isBuiltIn: true,
    folderId: 'builtin_arnold',
    exerciseIds: ['bench-press', 'incline-bench', 'dumbbell-fly', 'barbell-row', 'lat-pulldown', 'seated-row'],
  },
  {
    id: 'arnold-shoulders-arms',
    name: 'Shoulders & Arms',
    description: 'From Arnold Split.',
    isBuiltIn: true,
    folderId: 'builtin_arnold',
    exerciseIds: ['arnold-press', 'lateral-raise', 'face-pull', 'barbell-curl', 'tricep-pushdown', 'hammer-curl', 'skull-crusher'],
  },
  {
    id: 'arnold-legs',
    name: 'Legs',
    description: 'From Arnold Split.',
    isBuiltIn: true,
    folderId: 'builtin_arnold',
    exerciseIds: ['squat', 'leg-press', 'leg-extension', 'leg-curl', 'calf-raise', 'plank'],
  },
];

export const BUILT_IN_TEMPLATE_MAP = new Map(BUILT_IN_TEMPLATES.map((t) => [t.id, t]));
