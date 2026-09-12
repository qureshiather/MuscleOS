export type ProFeature =
  | 'custom_templates'
  | 'custom_exercises'
  | 'empty_workout'
  | 'add_exercise_mid_workout'
  | 'replace_exercise_mid_workout'
  | 'save_as_template'
  | 'personal_records'
  | 'exercise_progression'
  | 'monthly_calendar';

export const PRO_FEATURE_LABELS: Record<ProFeature, string> = {
  custom_templates: 'Custom workout templates',
  custom_exercises: 'Custom exercises',
  empty_workout: 'Empty / ad-hoc workouts',
  add_exercise_mid_workout: 'Add exercises mid-workout',
  replace_exercise_mid_workout: 'Replace exercises mid-workout',
  save_as_template: 'Save workout as template',
  personal_records: 'Personal records & 1RM tracking',
  exercise_progression: 'Exercise progression charts',
  monthly_calendar: 'Monthly training calendar',
};

/** Pro highlights on the paywall — keep the same count as BASIC_FEATURES_LIST. */
export const PRO_FEATURES_LIST = [
  'Custom workout templates & folders',
  'Custom exercises',
  'Empty workouts & mid-session edits',
  'Save a finished workout as a template',
  'PRs, charts, and monthly calendar',
] as const;

/** Basic tier highlights for comparison on the paywall. */
export const BASIC_FEATURES_LIST = [
  '5 built-in programs (PPL & Strong Lifts)',
  'Full set logging & rest timers',
  'Exercise library',
  'Recovery map',
  'History & JSON export',
] as const;

export function subscriptionPaywallPath(feature?: ProFeature): `/subscription${string}` {
  return feature ? `/subscription?feature=${feature}` : '/subscription';
}

export function parseProFeatureParam(value: string | undefined): ProFeature | null {
  if (!value) return null;
  if (value in PRO_FEATURE_LABELS) return value as ProFeature;
  return null;
}
