import type { WorkoutTemplate, TemplateFolder } from '@muscleos/types';

/** Built-in folder groups. Not stored; used to organize built-in templates in the UI. */
export const BUILT_IN_FOLDERS: TemplateFolder[] = [
  { id: 'builtin_ppl', name: 'Push Pull Legs' },
  { id: 'builtin_sl', name: 'Strong Lifts 5x5' },
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
];

export const BUILT_IN_TEMPLATE_MAP = new Map(BUILT_IN_TEMPLATES.map((t) => [t.id, t]));
