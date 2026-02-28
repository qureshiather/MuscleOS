import type { WorkoutTemplate } from '@muscleos/types';

/** Built-in workout templates. Not stored; merged with user templates in UI. */
export const BUILT_IN_TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'ppl',
    name: 'Push Pull Legs',
    description: 'Classic 6-day split: Push, Pull, Legs, repeat.',
    isBuiltIn: true,
    days: [
      {
        id: 'ppl-push',
        name: 'Push',
        exerciseIds: ['bench-press', 'overhead-press', 'incline-bench', 'lateral-raise', 'tricep-pushdown', 'skull-crusher'],
      },
      {
        id: 'ppl-pull',
        name: 'Pull',
        exerciseIds: ['barbell-row', 'pull-up', 'lat-pulldown', 'face-pull', 'barbell-curl', 'hammer-curl'],
      },
      {
        id: 'ppl-legs',
        name: 'Legs',
        exerciseIds: ['squat', 'romanian-deadlift', 'leg-press', 'leg-curl', 'calf-raise', 'plank'],
      },
    ],
  },
  {
    id: 'upper-lower',
    name: 'Upper Lower',
    description: '4-day split: Upper A, Lower A, Upper B, Lower B.',
    isBuiltIn: true,
    days: [
      {
        id: 'ul-upper-a',
        name: 'Upper A',
        exerciseIds: ['bench-press', 'barbell-row', 'overhead-press', 'lat-pulldown', 'tricep-pushdown', 'barbell-curl'],
      },
      {
        id: 'ul-lower-a',
        name: 'Lower A',
        exerciseIds: ['squat', 'romanian-deadlift', 'leg-press', 'leg-curl', 'calf-raise', 'plank'],
      },
      {
        id: 'ul-upper-b',
        name: 'Upper B',
        exerciseIds: ['incline-bench', 'seated-row', 'dumbbell-ohp', 'pull-up', 'skull-crusher', 'hammer-curl'],
      },
      {
        id: 'ul-lower-b',
        name: 'Lower B',
        exerciseIds: ['deadlift', 'leg-extension', 'hip-thrust', 'lunges', 'calf-raise', 'back-extension'],
      },
    ],
  },
  {
    id: 'stronglifts',
    name: 'Strong Lifts 5x5',
    description: 'A and B alternating, 5 sets of 5 reps.',
    isBuiltIn: true,
    days: [
      {
        id: 'sl-a',
        name: 'Workout A',
        exerciseIds: ['squat', 'bench-press', 'barbell-row'],
        defaultSets: 5,
      },
      {
        id: 'sl-b',
        name: 'Workout B',
        exerciseIds: ['squat', 'overhead-press', 'deadlift'],
        defaultSets: 5,
      },
    ],
  },
  {
    id: 'arnold',
    name: 'Arnold Split',
    description: 'Chest/Back, Shoulders/Arms, Legs.',
    isBuiltIn: true,
    days: [
      {
        id: 'arnold-chest-back',
        name: 'Chest & Back',
        exerciseIds: ['bench-press', 'incline-bench', 'dumbbell-fly', 'barbell-row', 'lat-pulldown', 'seated-row'],
      },
      {
        id: 'arnold-shoulders-arms',
        name: 'Shoulders & Arms',
        exerciseIds: ['arnold-press', 'lateral-raise', 'face-pull', 'barbell-curl', 'tricep-pushdown', 'hammer-curl', 'skull-crusher'],
      },
      {
        id: 'arnold-legs',
        name: 'Legs',
        exerciseIds: ['squat', 'leg-press', 'leg-extension', 'leg-curl', 'calf-raise', 'plank'],
      },
    ],
  },
];

export const BUILT_IN_TEMPLATE_MAP = new Map(BUILT_IN_TEMPLATES.map((t) => [t.id, t]));
