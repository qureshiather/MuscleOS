export const STORAGE_KEYS = {
  templates: 'muscleos_templates',
  templateFolders: 'muscleos_template_folders',
  /** Built-in template IDs soft-hidden on the home screen */
  hiddenBuiltInTemplateIds: 'muscleos_hidden_builtin_template_ids',
  sessions: 'muscleos_sessions',
  recovery: 'muscleos_recovery',
  health: 'muscleos_health',
  subscription: 'muscleos_subscription',
  exercisePrevious: 'muscleos_exercise_previous',
  exerciseNotes: 'muscleos_exercise_notes',
  customExercises: 'muscleos_custom_exercises',
  devProOverride: 'muscleos_dev_pro_override',
  syncOutbox: 'muscleos_sync_outbox',
  syncMeta: 'muscleos_sync_meta',
} as const;
