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
  'Built-in PPL, Upper/Lower & Strong Lifts',
  'Full set logging & rest timers',
  'Exercise library',
  'Recovery map',
  'History & JSON export',
] as const;

/**
 * Custom templates are Pro content to *run*, not just to create.
 *
 * A lapsed Pro account keeps its templates — they are never deleted, and they stay
 * visible so the data does not look lost — but starting one requires an active
 * subscription. A workout already in progress when the subscription lapses may
 * still be finished; the gate applies to starting a new one.
 */
export function requiresProToStart(template: { isBuiltIn?: boolean }): boolean {
  return template.isBuiltIn !== true;
}

/** Template id the home screen uses for an empty / ad-hoc workout. */
export const EMPTY_WORKOUT_TEMPLATE_ID = '_empty';

/**
 * What the start-from-params path in `/active-workout` (and the guard in `/workout-preview`)
 * should do: `'wait'` (nothing to do yet), `'start'`, or the Pro feature whose paywall to show.
 *
 * Those routes are reachable directly by deep link and notification tap, so this is the last line
 * of defence. It waits until templates and the subscription tier have loaded, so a custom template
 * is never mistaken for an unknown id and a Pro user is never bounced while the tier is unknown.
 * On Basic only a **known built-in** template starts: `_empty` and any unknown id would be an
 * ad-hoc workout, so both go to the `empty_workout` paywall. An existing session is never touched
 * (`'wait'`): a lapse doesn't block finishing a workout already in progress.
 * See docs/features/subscriptions.md#single-enforcement-predicate.
 */
export function startFromParamsDecision(args: {
  hasSession: boolean;
  templatesLoaded: boolean;
  subscriptionLoaded: boolean;
  isPro: boolean;
  templateId: string;
  template: { isBuiltIn?: boolean } | undefined;
}): 'wait' | 'start' | ProFeature {
  if (args.hasSession || !args.templateId) return 'wait';
  if (!args.templatesLoaded || !args.subscriptionLoaded) return 'wait';
  if (args.isPro) return 'start';
  if (args.templateId === EMPTY_WORKOUT_TEMPLATE_ID || args.template == null) return 'empty_workout';
  if (requiresProToStart(args.template)) return 'custom_templates';
  return 'start';
}

/**
 * Whether a whole-screen gate (`useRequirePro`) should send the user to the paywall. Never while
 * the tier is still loading, so a Pro user isn't bounced before the cached tier or RevenueCat
 * answers.
 */
export function shouldRedirectToPaywall(args: { isPro: boolean; isLoading: boolean }): boolean {
  return !args.isPro && !args.isLoading;
}

/**
 * Mid-workout add / replace / remove. On Basic a **built-in** workout gets the "Built-in workout"
 * alert for all three (built-ins are immutable for everyone); otherwise add and replace are Pro
 * features and removing an exercise is allowed.
 */
export function midWorkoutEditDecision(args: {
  action: 'add' | 'replace' | 'remove';
  isBuiltIn: boolean;
  isPro: boolean;
}): 'allow' | 'builtin-alert' | ProFeature {
  if (args.isPro) return 'allow';
  if (args.isBuiltIn) return 'builtin-alert';
  if (args.action === 'add') return 'add_exercise_mid_workout';
  if (args.action === 'replace') return 'replace_exercise_mid_workout';
  return 'allow';
}

export function subscriptionPaywallPath(feature?: ProFeature): `/subscription${string}` {
  return feature ? `/subscription?feature=${feature}` : '/subscription';
}

export function parseProFeatureParam(value: string | undefined): ProFeature | null {
  if (!value) return null;
  if (value in PRO_FEATURE_LABELS) return value as ProFeature;
  return null;
}
