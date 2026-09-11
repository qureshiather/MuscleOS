export type FaqScreenshot = {
  src: string;
  alt: string;
  label: string;
};

export type FaqItem = {
  id: string;
  question: string;
  /** Plain-text answer for JSON-LD / search. */
  answerText: string;
  paragraphs: string[];
  bullets?: string[];
  steps?: string[];
  screenshot?: FaqScreenshot;
  aside?: string;
  defaultOpen?: boolean;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'how-to-workout',
    question: 'How do I start a workout?',
    defaultOpen: true,
    screenshot: {
      src: '/screens/workouts.png',
      alt: 'MuscleOS Workouts tab with empty workout, suggested templates, and custom Pull / Push days',
      label: 'Workouts',
    },
    paragraphs: [
      'Open the Workouts tab. Tap a template to start it, or tap Empty workout to add exercises as you go.',
    ],
    answerText:
      'Open the Workouts tab and tap a template. You can also tap Empty workout to add exercises as you go. Empty workouts require Pro.',
  },
  {
    id: 'log-sets',
    question: 'How do I log sets?',
    paragraphs: [
      'Enter the weight and reps for each set, then tap the checkmark when the set is done. The rest timer starts automatically.',
    ],
    answerText:
      'Enter the weight and reps for a set, then tap the checkmark. The rest timer starts when you complete a set.',
  },
  {
    id: 'edit-exercises',
    question: 'How do I change the exercises in a workout?',
    paragraphs: ['You can change the exercise list while the workout is running.'],
    bullets: [
      'To add an exercise, scroll to the bottom and tap Add Exercise.',
      'To replace or remove one, tap the three dots beside its name.',
      'To reorder exercises, press and hold an exercise name, then drag it.',
    ],
    aside: 'Editing the exercise list during a workout requires Pro.',
    answerText:
      'Use Add Exercise at the bottom to add an exercise. Use the three-dot menu to replace or remove one. Press and hold an exercise name to reorder it. Editing the list requires Pro.',
  },
  {
    id: 'finish-cancel',
    question: 'How do I finish a workout?',
    paragraphs: [
      'Tap Finish in the top-right. Review the summary, then tap Save values.',
      'If you changed the workout, you can also update the template or save it as a new template. These options require Pro.',
      'To cancel instead, scroll to the bottom and tap Cancel workout.',
    ],
    answerText:
      'Tap Finish in the top-right, review the summary, and save your values. Pro can also update the template or save a new one. Cancel workout is at the bottom.',
  },
  {
    id: 'templates',
    question: 'How do I create a workout template?',
    paragraphs: [
      'On the Workouts tab, tap + New. Give the template a name, add exercises, and choose the number of sets.',
      'You can also save a finished workout as a new template.',
    ],
    aside: 'Creating templates requires Pro.',
    answerText:
      'Tap + New on the Workouts tab, name the template, add exercises, and choose the number of sets. Creating templates requires Pro.',
  },
  {
    id: 'recovery',
    question: 'How does Recovery work?',
    screenshot: {
      src: '/screens/recovery.png',
      alt: 'MuscleOS Recovery tab with front and back muscle diagrams',
      label: 'Recovery',
    },
    paragraphs: [
      'Recovery updates after you save a workout. It shows which muscles are ready and which are still recovering.',
      'The Workouts tab also suggests templates based on the muscles that are ready.',
    ],
    aside: 'Recovery and workout suggestions are included with Basic.',
    answerText:
      'Recovery updates after each saved workout and shows which muscles are ready or still recovering. Suggested workouts use the same data. Both are included with Basic.',
  },
  {
    id: 'history',
    question: 'Where can I see past workouts?',
    screenshot: {
      src: '/screens/history.png',
      alt: 'MuscleOS History tab showing past sessions with volume and sets',
      label: 'History',
    },
    paragraphs: [
      'Open the History tab. Tap a workout to see its exercises, sets, duration, and total volume.',
    ],
    answerText:
      'Open the History tab and tap a workout to see its exercises, sets, duration, and total volume.',
  },
  {
    id: 'exercises',
    question: 'How do I find exercises?',
    screenshot: {
      src: '/screens/exercises.png',
      alt: 'MuscleOS exercise library with search and muscle filters',
      label: 'Exercises',
    },
    paragraphs: [
      'Open the Exercises tab. Search by name or filter by muscle and equipment. Tap an exercise to see its instructions and muscle map.',
    ],
    answerText:
      'Open the Exercises tab and search by name, muscle, or equipment. Tap an exercise to see instructions and its muscle map.',
  },
  {
    id: 'hide-templates',
    question: 'How do I hide a template?',
    paragraphs: [
      'On the Workouts tab, tap the three dots on the template and choose Hide. Use the same menu to show it again.',
    ],
    answerText:
      'Tap the three dots on a template and choose Hide. Use the same menu to show it again.',
  },
];
