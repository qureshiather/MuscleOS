import { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { useTheme } from '@/theme/ThemeContext';
import { Screen } from '@/components/layout';
import { typography } from '@/theme/typography';
import { radius, spacing, touch } from '@/theme/tokens';
import { fontScaleCap, useBottomSpace } from '@/theme/layout';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTemplatesStore } from '@/store/templatesStore';
import { useExercisesStore } from '@/store/exercisesStore';
import type { MuscleId } from '@muscleos/types';
import { formatMuscleLabels } from '@muscleos/types';
import { Ionicons } from '@expo/vector-icons';
import { MuscleDiagram } from '@/components/MuscleDiagram';
import { Card } from '@/components/ui/Card';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import type { ThemeColors } from '@/theme/palette';
import {
  DEFAULT_SETS_PER_EXERCISE,
  applyRestToAll,
  editorRestPatch,
  formatTemplateRestLabel,
  resolveTemplateExercises,
  sharedRest,
  type ResolvedTemplateExercise,
} from '@/utils/templateExercises';
import { planSizeLabel } from '@/utils/templateCard';
import { useSettingsStore } from '@/store/settingsStore';
import { muscleLabel } from '@muscleos/types';
import { RestTimersDialog } from '@/components/workouts/RestTimersDialog';
import { ExercisePickerSheet } from '@/components/workouts/ExercisePickerSheet';
import { buildTemplateSave, validateTemplateDraft } from '@/utils/templateDraft';

export default function CreateTemplateScreen() {
  const { colors, isDark } = useTheme();
  const bottomSpace = useBottomSpace(spacing.xl);
  const router = useRouter();
  const { templateId: editTemplateId } = useLocalSearchParams<{ templateId?: string }>();
  const addTemplate = useTemplatesStore((s) => s.addTemplate);
  const updateTemplate = useTemplatesStore((s) => s.updateTemplate);
  const loadTemplates = useTemplatesStore((s) => s.load);
  const userTemplates = useTemplatesStore((s) => s.userTemplates);
  const folders = useTemplatesStore((s) => s.folders);
  const templatesLoading = useTemplatesStore((s) => s.isLoading);
  const savingRef = useRef(false);

  const isEditMode = Boolean(editTemplateId?.trim());
  const existingTemplate = useMemo(
    () => (isEditMode ? userTemplates.find((t) => t.id === editTemplateId) : null),
    [isEditMode, editTemplateId, userTemplates]
  );

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (existingTemplate) {
      setName(existingTemplate.name);
      setSelected(resolveTemplateExercises(existingTemplate));
      setFolderId(existingTemplate.folderId);
    }
  }, [existingTemplate?.id]);

  const getExercise = useExercisesStore((s) => s.getExercise);
  const defaultRestSeconds = useSettingsStore((s) => s.defaultRestSeconds);

  const [name, setName] = useState('');
  const [selected, setSelected] = useState<ResolvedTemplateExercise[]>([]);
  const [folderId, setFolderId] = useState<string | undefined>(undefined);
  const [showPicker, setShowPicker] = useState(false);
  /** Exercise whose rest timers are being edited. */
  const [restExerciseId, setRestExerciseId] = useState<string | null>(null);
  const restExercise = selected.find((ex) => ex.exerciseId === restExerciseId);
  /** **Edit all rests** dialog. */
  const [restForAll, setRestForAll] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedIds = selected.map((ex) => ex.exerciseId);


  function addExerciseId(id: string) {
    if (selectedIds.includes(id)) return;
    setSelected((prev) => [
      ...prev,
      { exerciseId: id, sets: DEFAULT_SETS_PER_EXERCISE, warmUpSets: 0 },
    ]);
    setPickerSearch('');
  }

  function removeExerciseId(id: string) {
    setSelected((prev) => prev.filter((ex) => ex.exerciseId !== id));
  }

  function updateExercise(id: string, patch: Partial<ResolvedTemplateExercise>) {
    setSelected((prev) => prev.map((ex) => (ex.exerciseId === id ? { ...ex, ...patch } : ex)));
  }

  /** A rest equal to the default stays implicit, so a later change to the default still applies. */
  function saveRest(id: string, work: number, warmUp: number) {
    updateExercise(id, editorRestPatch(work, warmUp, defaultRestSeconds));
  }

  /** Picker → New exercise form, prefilled with the search text when there is some. */
  function createExercise(name: string) {
    closePicker();
    router.push({ pathname: '/create-exercise', params: name ? { name } : {} });
  }

  function closePicker() {
    setShowPicker(false);
    setPickerSearch('');
  }


  async function handleSave() {
    if (savingRef.current) return;
    if (!validateTemplateDraft(name, selected).valid) {
      setShowErrors(true);
      return;
    }
    const save = buildTemplateSave({
      existing: existingTemplate,
      isEditMode,
      name,
      plan: selected,
      folderId,
      now: Date.now(),
      rand: Math.random().toString(36).slice(2, 9),
    });
    if (save.kind === 'not-found') return;
    setShowErrors(false);
    savingRef.current = true;
    setSaving(true);
    try {
      if (save.kind === 'update') await updateTemplate(save.id, save.patch);
      else await addTemplate(save.template);
      router.back();
    } catch {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const templateMuscleIds: MuscleId[] = useMemo(
    () => Array.from(new Set(selectedIds.flatMap((id) => getExercise(id)?.muscles ?? []))),
    [selectedIds, getExercise]
  );

  const canReorder = selectedIds.length > 1;
  const errors = validateTemplateDraft(name, selected);
  /** Edit link for an id that isn't one of your custom templates (unknown, deleted, or built-in). */
  const notFound = isEditMode && !templatesLoading && existingTemplate == null;


  if (notFound) {
    return (
      <Screen kind="chrome">
        <ScreenHeader title="Edit template" onBack={() => router.back()} backIcon="close" />
        <View style={styles.form}>
          <Text style={[typography.bodyMedium, { color: colors.text }]}>Template not found</Text>
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>
            It may have been deleted. Built-in templates can't be edited.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <Screen kind="chrome">
      <ScreenHeader
        title={isEditMode ? 'Edit template' : 'New template'}
        onBack={() => router.back()}
        backIcon="close"
      />
      <DraggableFlatList
        data={selected}
        keyExtractor={(item) => item.exerciseId}
        onDragEnd={({ data }) => setSelected(data)}
        activationDistance={8}
        containerStyle={styles.scroll}
        contentContainerStyle={[styles.form, { paddingBottom: bottomSpace }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <Text style={[typography.label, styles.label, { color: colors.textSecondary }]}>Template name</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  color: colors.text,
                  borderColor: showErrors && errors.name ? colors.danger : colors.border,
                },
              ]}
              placeholder="e.g. Push A"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (showErrors) setShowErrors(false);
              }}
            />
            {showErrors && errors.name ? (
              <Text style={[typography.caption, styles.errorText, { color: colors.danger }]}>
                {errors.name}
              </Text>
            ) : null}

            {folders.length > 0 && (
              <>
                <Text style={[typography.label, styles.label, { color: colors.textSecondary }]}>Folder</Text>
                <View style={styles.folderRow}>
                  <Pressable
                    style={[
                      styles.folderChip,
                      {
                        borderColor: colors.border,
                        backgroundColor: !folderId ? colors.primary : colors.surface,
                      },
                    ]}
                    onPress={() => setFolderId(undefined)}
                  >
                    <Text
                      style={[typography.label, { color: !folderId ? colors.primaryOn : colors.textSecondary }]}
                    >
                      None
                    </Text>
                  </Pressable>
                  {folders.map((f) => (
                    <Pressable
                      key={f.id}
                      style={[
                        styles.folderChip,
                        {
                          borderColor: colors.border,
                          backgroundColor: folderId === f.id ? colors.primary : colors.surface,
                        },
                      ]}
                      onPress={() => setFolderId(f.id)}
                    >
                      <Text
                        style={[typography.label, { color: folderId === f.id ? colors.primaryOn : colors.text }]}
                      >
                        {f.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <View style={styles.exercisesHeader}>
              <View style={styles.exercisesHeaderText}>
                <Text style={[typography.label, { color: colors.textSecondary }]}>Exercises</Text>
                <Text style={[styles.planSize, { color: colors.textMuted }]} testID="template-plan-size">
                  {planSizeLabel(selected)}
                </Text>
              </View>
              {selected.length > 0 ? (
                <Pressable
                  onPress={() => setRestForAll(true)}
                  accessibilityRole="button"
                  testID="template-rest-all"
                  style={({ pressed }) => [
                    styles.restAllBtn,
                    { borderColor: colors.primaryBorder, backgroundColor: colors.primarySurface, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Ionicons name="timer-outline" size={16} color={colors.primary} />
                  <Text style={[typography.label, styles.restAllText, { color: colors.primary }]}>Edit all rests</Text>
                </Pressable>
              ) : null}
            </View>
            {canReorder ? (
              <Text style={[typography.caption, styles.reorderHint, { color: colors.textMuted }]}>
                Hold and drag to rearrange
              </Text>
            ) : null}
            {selectedIds.length === 0 ? (
              <Card
                elevated
                style={[
                  styles.selectedCard,
                  showErrors ? { borderColor: colors.danger } : null,
                ]}
              >
                <Text style={[typography.body, { color: colors.textMuted }]}>No exercises yet</Text>
              </Card>
            ) : null}
          </View>
        }
        ListFooterComponent={
          <View>
            {showErrors && errors.exercises ? (
              <Text style={[typography.caption, styles.errorText, { color: colors.danger }]}>
                {errors.exercises}
              </Text>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.addExercisesBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
              onPress={() => setShowPicker(true)}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
              <Text style={[typography.button, { color: colors.primary }]}>Add exercises</Text>
            </Pressable>

            {templateMuscleIds.length > 0 && (
              <Card style={styles.musclesSection}>
                <Text style={[typography.caption, styles.sectionLabel, { color: colors.textMuted }]}>
                  Muscles used
                </Text>
                <MuscleDiagram muscleIds={templateMuscleIds} size={0.85} />
                <Text style={[typography.caption, styles.muscleNames, { color: colors.textSecondary }]}>
                  {formatMuscleLabels(templateMuscleIds)}
                </Text>
              </Card>
            )}

            <PrimaryButton
              label={
                saving
                  ? 'Saving…'
                  : isEditMode
                    ? 'Save changes'
                    : 'Save template'
              }
              onPress={handleSave}
              disabled={saving}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        }
        renderItem={({ item, drag, isActive }: RenderItemParams<ResolvedTemplateExercise>) => {
          const ex = getExercise(item.exerciseId);
          const mainMuscle = ex?.muscles[0];
          return (
            <ScaleDecorator>
              <View
                testID={`template-exercise-${item.exerciseId}`}
                style={[
                  styles.exerciseCard,
                  { backgroundColor: isActive ? colors.surfaceElevated : colors.surface, borderColor: colors.border },
                  !isDark && [styles.exerciseCardLight, { shadowColor: colors.shadow }],
                  isActive && [styles.selectedRowActive, { shadowColor: colors.shadowCool }],
                ]}
              >
                <Pressable
                  onLongPress={canReorder ? drag : undefined}
                  delayLongPress={120}
                  style={styles.cardHeader}
                >
                  {canReorder ? (
                    <View style={styles.dragHandle}>
                      <Ionicons name="reorder-three" size={22} color={colors.textMuted} />
                    </View>
                  ) : null}
                  <View style={styles.cardTitle}>
                    <Text style={[typography.bodyMedium, { color: colors.text }]} numberOfLines={1}>
                      {ex?.name ?? item.exerciseId}
                    </Text>
                    {mainMuscle ? (
                      <View style={[styles.musclePill, { backgroundColor: colors.primarySurface }]}>
                        <Text style={[styles.musclePillText, { color: colors.primary }]}>{muscleLabel(mainMuscle)}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Pressable
                    hitSlop={8}
                    onPress={() => removeExerciseId(item.exerciseId)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${ex?.name ?? item.exerciseId}`}
                    style={styles.removeBtn}
                  >
                    <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                  </Pressable>
                </Pressable>
                <View style={[styles.countsRow, { borderTopColor: colors.border }]}>
                  <CountStepper
                    label="Sets"
                    value={item.sets}
                    min={1}
                    colors={colors}
                    onChange={(sets) => updateExercise(item.exerciseId, { sets })}
                  />
                  <CountStepper
                    label="Warm-ups"
                    value={item.warmUpSets}
                    min={0}
                    colors={colors}
                    onChange={(warmUpSets) => updateExercise(item.exerciseId, { warmUpSets })}
                  />
                </View>
                <View style={styles.restRow}>
                  <Text
                    style={[typography.caption, styles.restLabel, { color: colors.textMuted }]}
                    maxFontSizeMultiplier={fontScaleCap.chrome}
                  >
                    Rest
                  </Text>
                  <Pressable
                    onPress={() => setRestExerciseId(item.exerciseId)}
                    accessibilityRole="button"
                    accessibilityLabel={`Rest timers for ${ex?.name ?? item.exerciseId}: ${formatTemplateRestLabel(item, defaultRestSeconds)}`}
                    testID={`template-rest-${item.exerciseId}`}
                    style={[styles.restPill, { borderColor: colors.border }]}
                  >
                    <Ionicons name="timer-outline" size={14} color={colors.primary} />
                    <Text
                      style={[typography.data, { color: colors.text }]}
                      maxFontSizeMultiplier={fontScaleCap.tabular}
                      numberOfLines={1}
                    >
                      {formatTemplateRestLabel(item, defaultRestSeconds)}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScaleDecorator>
          );
        }}
      />

      <RestTimersDialog
        exerciseName={restExercise ? (getExercise(restExercise.exerciseId)?.name ?? restExercise.exerciseId) : null}
        initial={{
          work: restExercise?.restBetweenSetsSeconds ?? defaultRestSeconds,
          warmUp: restExercise?.warmUpRestSeconds ?? 0,
        }}
        hint="Starts after every set of this exercise when you work out from this template. 0:00 means no timer."
        onSave={(work, warmUp) => {
          if (restExerciseId) saveRest(restExerciseId, work, warmUp);
          setRestExerciseId(null);
        }}
        onClose={() => setRestExerciseId(null)}
      />

      <RestTimersDialog
        exerciseName={restForAll ? 'Every exercise' : null}
        title="Edit all rests"
        saveLabel="Apply to all"
        initial={sharedRest(selected, defaultRestSeconds)}
        hint="Sets the same rest on every exercise in this template. You can still change one afterwards. 0:00 means no timer."
        onSave={(work, warmUp) => {
          setSelected((prev) => applyRestToAll(prev, work, warmUp, defaultRestSeconds));
          setRestForAll(false);
        }}
        onClose={() => setRestForAll(false)}
      />

      {showPicker ? (
        <ExercisePickerSheet
          mode="add"
          excludeIds={selectedIds}
          search={pickerSearch}
          onSearchChange={setPickerSearch}
          onPick={addExerciseId}
          onCreate={() => createExercise(pickerSearch.trim())}
          showMuscles
          onClose={closePicker}
        />
      ) : null}
    </Screen>
    </GestureHandlerRootView>
  );
}

function CountStepper({
  label,
  value,
  min,
  colors,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  colors: ThemeColors;
  onChange: (n: number) => void;
}) {
  const atMin = value <= min;
  return (
    <View style={styles.stepper}>
      <Text
        style={[typography.caption, { color: colors.textMuted }]}
        maxFontSizeMultiplier={fontScaleCap.chrome}
      >
        {label}
      </Text>
      <View style={styles.stepperControls}>
        <Pressable
          onPress={() => onChange(value - 1)}
          disabled={atMin}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          style={[
            styles.stepperBtn,
            { borderColor: colors.border, opacity: atMin ? 0.4 : 1 },
          ]}
        >
          <Ionicons name="remove" size={16} color={colors.text} />
        </Pressable>
        <Text
          style={[typography.data, styles.stepperValue, { color: colors.text }]}
          maxFontSizeMultiplier={fontScaleCap.tabular}
          accessibilityLabel={`${value} ${label}`}
        >
          {value}
        </Text>
        <Pressable
          onPress={() => onChange(value + 1)}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          style={[styles.stepperBtn, { borderColor: colors.border }]}
        >
          <Ionicons name="add" size={16} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  form: { padding: spacing.lg + 4, paddingBottom: 40 },
  label: { marginBottom: spacing.sm, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
    marginBottom: spacing.sm,
  },
  errorText: { marginBottom: spacing.md },
  folderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  folderChip: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  selectedCard: { marginBottom: spacing.md, paddingVertical: spacing.sm },
  reorderHint: { marginBottom: spacing.sm, marginTop: -spacing.xs },
  exerciseCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    overflow: 'visible',
  },
  exerciseCardLight: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
  },
  cardTitle: { flex: 1, minWidth: 0, gap: 4, paddingLeft: spacing.xs },
  musclePill: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.sm },
  musclePillText: { ...typography.caption, fontSize: 11, fontWeight: '600' },
  exercisesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  exercisesHeaderText: { gap: 2, flexShrink: 1 },
  planSize: { ...typography.caption, fontFamily: typography.data.fontFamily, fontVariant: ['tabular-nums'] },
  restAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: touch.min - 8,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  restAllText: { fontWeight: '600' },
  countsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  restLabel: { minWidth: 32 },
  stepper: {
    gap: 4,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepperBtn: {
    width: touch.min - 8,
    height: touch.min - 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: touch.min - 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  stepperValue: {
    minWidth: 22,
    textAlign: 'center',
  },
  removeBtn: {
    minWidth: touch.min - 8,
    minHeight: touch.min - 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedRowActive: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  addExercisesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  musclesSection: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  sectionLabel: {
    fontFamily: typography.label.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.md,
  },
  muscleNames: { marginTop: spacing.sm, textAlign: 'center' },
});
