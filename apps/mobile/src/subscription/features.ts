export type ProFeature =
  | 'custom_templates'
  | 'custom_exercises'
  | 'empty_workout'
  | 'add_exercise_mid_workout'
  | 'save_as_template'
  | 'personal_records'
  | 'exercise_progression'
  | 'monthly_calendar';

export const PRO_FEATURE_LABELS: Record<ProFeature, string> = {
  custom_templates: 'Custom workout templates',
  custom_exercises: 'Custom exercises',
  empty_workout: 'Empty / ad-hoc workouts',
  add_exercise_mid_workout: 'Add exercises mid-workout',
  save_as_template: 'Save workout as template',
  personal_records: 'Personal records & 1RM tracking',
  exercise_progression: 'Exercise progression charts',
  monthly_calendar: 'Monthly training calendar',
};

/** Pro features shown on the paywall (ordered). */
export const PRO_FEATURES_LIST = [
  PRO_FEATURE_LABELS.custom_templates,
  PRO_FEATURE_LABELS.custom_exercises,
  PRO_FEATURE_LABELS.empty_workout,
  PRO_FEATURE_LABELS.add_exercise_mid_workout,
  PRO_FEATURE_LABELS.save_as_template,
  PRO_FEATURE_LABELS.personal_records,
  PRO_FEATURE_LABELS.exercise_progression,
  PRO_FEATURE_LABELS.monthly_calendar,
] as const;

/** Basic tier highlights for comparison on the paywall. */
export const BASIC_FEATURES_LIST = [
  '5 built-in programs (PPL & Strong Lifts)',
  'Full workout logging & rest timers',
  'Exercise library & recovery tracking',
  'Workout history & data export',
] as const;

export function subscriptionPaywallPath(feature?: ProFeature): `/subscription${string}` {
  return feature ? `/subscription?feature=${feature}` : '/subscription';
}

export function parseProFeatureParam(value: string | undefined): ProFeature | null {
  if (!value) return null;
  if (value in PRO_FEATURE_LABELS) return value as ProFeature;
  return null;
}
