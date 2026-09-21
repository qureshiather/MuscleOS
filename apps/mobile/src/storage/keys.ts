export const STORAGE_KEYS = {
  templates: 'muscleos_templates',
  templateFolders: 'muscleos_template_folders',
  /** Built-in template IDs soft-hidden on the home screen */
  hiddenBuiltInTemplateIds: 'muscleos_hidden_builtin_template_ids',
  /** Built-in folder IDs soft-hidden on the home screen (hides every template in the folder) */
  hiddenBuiltInFolderIds: 'muscleos_hidden_builtin_folder_ids',
  sessions: 'muscleos_sessions',
  /** In-progress workout, so it survives the OS killing the app mid-session */
  activeWorkout: 'muscleos_active_workout',
  recovery: 'muscleos_recovery',
  health: 'muscleos_health',
  subscription: 'muscleos_subscription',
  exercisePrevious: 'muscleos_exercise_previous',
  exerciseNotes: 'muscleos_exercise_notes',
  customExercises: 'muscleos_custom_exercises',
  catalogExercises: 'muscleos_catalog_exercises',
  catalogWatermark: 'muscleos_catalog_watermark',
  catalogSeedAppliedAt: 'muscleos_catalog_seed_applied_at',
  devProOverride: 'muscleos_dev_pro_override',
  syncOutbox: 'muscleos_sync_outbox',
  syncMeta: 'muscleos_sync_meta',
  /** Android only: whether we already asked for the "Alarms & reminders" access */
  exactAlarmPromptShown: 'muscleos_exact_alarm_prompt_shown',
  /** Short-lived Apple authorization code, kept so account deletion can revoke Sign in with Apple. */
  appleAuthorizationCode: 'muscleos_apple_authorization_code',
} as const;
