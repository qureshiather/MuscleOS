import { SUPPORT_EMAIL } from './contact';

/**
 * Every answer here describes shipped app behaviour and must match the specs in `docs/features/`
 * (workout-logging, templates, recovery, exercise-library, history-analytics, subscriptions,
 * accounts-and-data). Update this file in the same change as any behaviour it describes.
 */
export type FaqItem = {
  id: string;
  question: string;
  /** Plain-text answer for JSON-LD / search. */
  answerText: string;
  paragraphs: string[];
  bullets?: string[];
  steps?: string[];
  instructionGroups?: {
    title: string;
    steps: string[];
  }[];
  aside?: string;
  contactEmail?: string;
  defaultOpen?: boolean;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'how-to-workout',
    question: 'How do I start a workout?',
    defaultOpen: true,
    paragraphs: ['Open the Workouts tab, then follow the steps for your plan:'],
    instructionGroups: [
      {
        title: 'Basic',
        steps: [
          'Tap one of the built-in templates: Push Pull Legs, Upper/Lower, or Strong Lifts 5×5.',
          'Check the exercises and what you lifted last time, then tap Start workout.',
        ],
      },
      {
        title: 'Pro',
        steps: [
          'Tap a built-in or custom template and start it from the preview.',
          'Or tap Empty workout to start with no exercises and add them as you go.',
        ],
      },
    ],
    aside: 'Only one workout runs at a time. Finish or cancel the current one before starting another.',
    answerText:
      'Open the Workouts tab and tap a built-in template (Push Pull Legs, Upper/Lower, or Strong Lifts 5×5), check the preview, and tap Start workout. Pro can also run custom templates or start an empty workout. Only one workout runs at a time.',
  },
  {
    id: 'log-sets',
    question: 'How do I log sets?',
    paragraphs: [
      'Tap the weight or reps in a set to open the number pad. Next moves from weight to reps, and Done completes the set. You can also tap the checkmark at the end of the row.',
      'A set needs at least 1 rep. Weight is optional, for bodyweight work.',
      'Previous shows the best set from the last time you did that exercise. Its weight and reps are filled in as a suggestion; the first digit you type replaces it.',
    ],
    answerText:
      'Tap weight or reps to open the number pad, enter the values, and tap Done (or the checkmark) to complete the set. A set needs at least 1 rep. Previous shows your best set from the last session and is filled in as a suggestion.',
  },
  {
    id: 'rest-timer',
    question: 'How does the rest timer work?',
    paragraphs: [
      'Completing a working set starts a 2:00 rest. While it runs you can add or remove 30 seconds or skip it. The rest you actually took is shown under the set number.',
      'To change the rest for an exercise, tap the three dots beside its name and choose Update rest timers. Each exercise has a work-set rest and a warm-up rest, from 0:00 to 15:00. Warm-ups don’t start a timer unless you set one.',
      'When the rest ends you get a notification, even if the app is in the background.',
    ],
    answerText:
      'Completing a working set starts a 2:00 rest you can extend, shorten, or skip. Use Update rest timers in the exercise menu to set work-set and warm-up rests from 0:00 to 15:00. A notification tells you when rest is over.',
  },
  {
    id: 'edit-exercises',
    question: 'Can I change the exercises during a workout?',
    paragraphs: ['Yes. What you can change depends on your plan:'],
    bullets: [
      'Reorder: press and hold an exercise name, then drag it. Included with Basic.',
      'Add: tap Add Exercise at the bottom of the workout. Requires Pro.',
      'Replace: tap the three dots beside an exercise and choose Replace exercise. Requires Pro.',
      'Remove: tap the three dots and choose Remove exercise.',
    ],
    aside:
      'Built-in workouts can’t be edited on Basic. With Pro you can change the session and save it as a new template when you finish.',
    answerText:
      'Press and hold an exercise name to reorder (Basic). Add Exercise and Replace exercise require Pro. Remove is in the three-dot menu. On Basic, built-in workouts can’t be edited; Pro can save the changed session as a new template.',
  },
  {
    id: 'finish-cancel',
    question: 'How do I finish or cancel a workout?',
    paragraphs: [
      'Tap Finish in the top-right once you’ve completed at least one set. Review the summary and tap Save values. Sets you didn’t complete are kept in the session but don’t count toward recovery or your stats.',
      'If you changed the exercises or number of sets, Pro can also save the workout as a new template, or overwrite the custom template you started from.',
      'To cancel, scroll to the bottom and tap Cancel workout, then Discard workout.',
    ],
    answerText:
      'Tap Finish after completing at least one set, review the summary, and save. Pro can save a changed workout as a new template or overwrite its custom template. To cancel, tap Cancel workout at the bottom and confirm.',
  },
  {
    id: 'forgot-to-finish',
    question: 'What if I forget to finish a workout?',
    paragraphs: [
      'A workout with no changes for 3 hours closes on its own the next time you open the app.',
      'If you completed at least one set, it’s saved as ending at your last change, so your history and recovery stay accurate. If you didn’t complete any sets, it’s discarded.',
    ],
    answerText:
      'A workout left untouched for 3 hours closes automatically. It is saved at the time of your last change if any set was completed, and discarded otherwise.',
  },
  {
    id: 'templates',
    question: 'How do I create a workout template?',
    paragraphs: [
      'On the Workouts tab, tap New. Name the template, add exercises, and set how many working and warm-up sets each one starts with.',
      'You can also finish a workout and save it as a new template.',
    ],
    aside:
      'Custom templates require Pro to create and to run. If Pro ends, your templates are kept and locked until you resubscribe.',
    answerText:
      'Tap New on the Workouts tab, name the template, add exercises, and set working and warm-up sets for each. You can also save a finished workout as a template. Custom templates require Pro to create and run.',
  },
  {
    id: 'recovery',
    question: 'How does Recovery work?',
    paragraphs: [
      'When you finish a workout, every muscle worked by an exercise with a completed set starts a recovery timer:',
    ],
    bullets: [
      '36 hours: abs, obliques, biceps, triceps, forearms.',
      '48 hours: front, side, and rear delts, calves, adductors.',
      '72 hours: chest, traps, lats, rhomboids, lower back, quads, hamstrings, glutes.',
    ],
    aside:
      'Weight, reps, and sets don’t change the timer. The Workouts tab suggests templates that use muscles that are ready. Recovery is included with Basic.',
    answerText:
      'Finishing a workout starts a recovery timer for each muscle you trained: 36 hours for smaller muscles like arms and abs, 48 hours for delts, calves, and adductors, and 72 hours for chest, back, and legs. Recovery is included with Basic.',
  },
  {
    id: 'history',
    question: 'Where can I see past workouts?',
    paragraphs: [
      'Open the History tab. Each workout shows its date, duration, total volume, and every completed set. Tap the trash icon to delete one; recovery and your previous values update to match.',
      'With Pro, the trophy button opens personal records (estimated one-rep max for each exercise, with progression charts) and the calendar button opens a monthly view.',
    ],
    answerText:
      'Open the History tab to see each workout’s date, duration, volume, and completed sets. Tap the trash icon to delete one. Pro adds personal records, progression charts, and a monthly calendar.',
  },
  {
    id: 'exercises',
    question: 'How do I find exercises?',
    paragraphs: [
      'Open the Exercises tab. Search by name, muscle, or equipment, or open Filters to narrow by type and muscle. Tap an exercise to see the muscles it works, its instructions, and your own notes.',
    ],
    aside: 'Creating your own exercises requires Pro.',
    answerText:
      'Open the Exercises tab and search by name, muscle, or equipment, or filter by type and muscle. Tap an exercise to see its muscle map, instructions, and your notes. Custom exercises require Pro.',
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
  {
    id: 'units',
    question: 'Can I use pounds?',
    paragraphs: [
      'Yes. Go to Profile → Settings → Units. Exercise weight, body weight, and height each have their own setting, so you can lift in kilograms and weigh yourself in pounds.',
    ],
    answerText:
      'Yes. Profile → Settings → Units has separate settings for exercise weight, body weight, and height.',
  },
  {
    id: 'account',
    question: 'Do I need an account?',
    paragraphs: [
      'No. Everything works on your phone without signing in, including offline.',
      'Sign in with Apple, Google, or email to back up your workouts, use them on another device, and buy Pro. Apple, Google, and email sign-ins with the same address are the same account.',
    ],
    answerText:
      'No. MuscleOS works without an account, including offline. Sign in with Apple, Google, or email to back up and sync your workouts and to buy Pro.',
  },
  {
    id: 'restore-pro',
    question: 'How do I get Pro on a new phone?',
    paragraphs: [
      'Sign in with the same account you used to buy Pro. Pro restores automatically. If it doesn’t, open Profile → Account → Subscription and tap Restore purchases.',
    ],
    answerText:
      'Sign in with the account you bought Pro on. It restores automatically, or tap Restore purchases on the Subscription screen.',
  },
  {
    id: 'data',
    question: 'How do I export or delete my data?',
    paragraphs: ['Everything is under Profile → Account:'],
    bullets: [
      'Export: Data → Export my data saves a JSON file of your workouts, templates, and exercises.',
      'Clear this phone: Data → Clear all data.',
      'Delete your account: Delete account removes it and your backup, then clears this phone.',
    ],
    aside:
      'Deleting your account doesn’t cancel a subscription. Cancel it in your App Store or Google Play settings.',
    answerText:
      'Go to Profile → Account. Data → Export my data saves a JSON file. Data → Clear all data clears this phone. Delete account removes your account and backup. Cancel subscriptions in App Store or Google Play settings.',
  },
  {
    id: 'support',
    question: 'How do I contact support?',
    paragraphs: ['Email us and we will get back to you.'],
    contactEmail: SUPPORT_EMAIL,
    answerText: `Email ${SUPPORT_EMAIL} and we will get back to you.`,
  },
];
