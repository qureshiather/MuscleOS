import type { WorkoutTemplate, TemplateFolder } from '@muscleos/types';

/** Built-in folder groups. Not stored; used to organize built-in templates in the UI. */
export const BUILT_IN_FOLDERS: TemplateFolder[] = [
  { id: 'builtin_ppl', name: 'Push Pull Legs' },
  { id: 'builtin_ul', name: 'Upper Lower Splits' },
  { id: 'builtin_sl', name: 'Strong Lifts 5x5' },
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
];

export const BUILT_IN_TEMPLATE_MAP = new Map(BUILT_IN_TEMPLATES.map((t) => [t.id, t]));

/** Soft-hide: the template itself, or its whole built-in folder. */
export function isBuiltInHidden(
  template: Pick<WorkoutTemplate, 'id' | 'folderId'>,
  hiddenTemplateIds: readonly string[],
  hiddenFolderIds: readonly string[]
): boolean {
  if (hiddenTemplateIds.includes(template.id)) return true;
  return Boolean(template.folderId && hiddenFolderIds.includes(template.folderId));
}
