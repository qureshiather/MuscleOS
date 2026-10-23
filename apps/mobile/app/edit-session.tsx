import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { type NavigationAction, usePreventRemove } from 'expo-router/react-navigation';
import { Ionicons } from '@expo/vector-icons';
import type { WorkoutSession } from '@muscleos/types';
import { Screen } from '@/components/layout';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { NumericKeypad } from '@/components/NumericKeypad';
import { ExercisePickerSheet } from '@/components/workouts/ExercisePickerSheet';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing, touch } from '@/theme/tokens';
import { fontScaleCap } from '@/theme/layout';
import { useSessionsStore } from '@/store/sessionsStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { templateDisplayName } from '@/utils/historyCards';
import { setLabel } from '@/utils/workoutSetView';
import {
  applyKeypadKey,
  keypadDisplayValue,
  keypadStep,
  type KeypadKey,
} from '@/utils/keypadInput';
import {
  DRAFT_PROBLEM_COPY,
  addDraftExercise,
  addDraftSet,
  removeDraftExercise,
  replaceDraftExercise,
  draftChanged,
  draftProblem,
  removeDraftSet,
  sessionEditDraft,
  updateDraftSet,
} from '@/utils/sessionEdit';

type FocusedCell = { exIdx: number; setIdx: number; field: 'weight' | 'reps'; replace: boolean };

function formatEditDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Fix a finished workout from History: weights, reps, sets and exercises, laid out like the
 * workout screen but with no clock, rest, sounds or done ticks
 * (docs/features/history-analytics.md#editing-a-session).
 */
export default function EditSessionScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const live = useSessionsStore((s) => s.sessions.find((x) => x.id === id));
  // Pinned once found: a sync that deletes the session mid-edit mustn't unmount the editor and lose
  // the draft; Save then reports it (Workout not found).
  const pinned = useRef<WorkoutSession | undefined>(undefined);
  if (!pinned.current && live) pinned.current = live;
  const original = pinned.current;

  if (!original) {
    return (
      <Screen kind="chrome">
        <View style={styles.missing}>
          <Text style={[typography.bodyMedium, { color: colors.text }]}>Workout not found</Text>
          <Pressable onPress={() => router.back()} hitSlop={touch.hitSlop}>
            <Text style={[typography.label, { color: colors.primary }]}>Back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }
  return <SessionEditor original={original} />;
}

function SessionEditor({ original }: { original: WorkoutSession }) {
  const { colors } = useTheme();
  const router = useRouter();
  const weightUnit = useSettingsStore((s) => s.weightUnit);
  const getExercise = useExercisesStore((s) => s.getExercise);
  const allTemplates = useTemplatesStore((s) => s.allTemplates);
  const sessions = useSessionsStore((s) => s.sessions);
  const saveSessionEdit = useSessionsStore((s) => s.saveSessionEdit);

  const [draft, setDraft] = useState(() => sessionEditDraft(original));
  const [focused, setFocused] = useState<FocusedCell | null>(null);
  const [keypadHeight, setKeypadHeight] = useState(0);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigation = useNavigation();
  /** Set once leaving is decided (saved, discarded): lifts the back guard, then navigates. */
  const [leaving, setLeaving] = useState<{ action?: NavigationAction } | null>(null);
  /** The back / swipe-back that the guard held while asking. */
  const heldAction = useRef<NavigationAction | undefined>(undefined);
  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'replace'; exIdx: number } | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [removeExIdx, setRemoveExIdx] = useState<number | null>(null);

  const title = useMemo(() => templateDisplayName(allTemplates(), original, sessions), [allTemplates, original, sessions]);
  const changed = draftChanged(original, draft);
  const problem = draftProblem(draft);
  const canSave = changed && problem == null && !saving;
  const unitLabel = weightUnit === 'lb' ? 'LB' : 'KG';

  const focusedSet = focused ? draft.exercises[focused.exIdx]?.sets[focused.setIdx] : undefined;
  const focusedValue = focusedSet && focused ? keypadDisplayValue(focusedSet, focused.field, weightUnit) : undefined;

  function exerciseName(exerciseId: string): string {
    return getExercise(exerciseId)?.name ?? exerciseId;
  }

  function pressKey(key: KeypadKey) {
    if (!focused || !focusedSet) return;
    const outcome = applyKeypadKey(focusedSet, focused.field, key, weightUnit, focused.replace);
    const { patch } = outcome;
    if (patch) {
      setDraft((d) => updateDraftSet(d, focused.exIdx, focused.setIdx, patch));
      if (focused.replace) setFocused({ ...focused, replace: false });
    }
    if (outcome.focus === null) setFocused(null);
    else if (outcome.focus) setFocused({ ...focused, field: outcome.focus === 'weight' ? 'weight' : 'reps', replace: true });
  }

  function deleteSet(exIdx: number, setIdx: number) {
    setFocused(null);
    setDraft((d) => removeDraftSet(d, exIdx, setIdx));
  }

  function openPicker(next: { mode: 'add' } | { mode: 'replace'; exIdx: number }) {
    setFocused(null);
    setPicker(next);
  }

  function closePicker() {
    setPicker(null);
    setPickerSearch('');
  }

  function pickExercise(exerciseId: string) {
    if (picker?.mode === 'replace') setDraft((d) => replaceDraftExercise(d, picker.exIdx, exerciseId));
    else setDraft((d) => addDraftExercise(d, exerciseId));
    closePicker();
  }

  // Back button and swipe-back ask too, not just Cancel.
  usePreventRemove(changed && leaving == null, ({ data }) => {
    setFocused(null);
    heldAction.current = data.action;
    setConfirmDiscard(true);
  });

  useEffect(() => {
    if (!leaving) return;
    if (leaving.action) navigation.dispatch(leaving.action);
    else router.back();
  }, [leaving, navigation, router]);

  function handleCancel() {
    setFocused(null);
    heldAction.current = undefined;
    if (changed) setConfirmDiscard(true);
    else router.back();
  }

  async function handleSave() {
    if (!canSave) return;
    setFocused(null);
    setSaving(true);
    const ok = await saveSessionEdit(draft);
    setSaving(false);
    if (ok) setLeaving({});
    else setSaveFailed(true);
  }

  return (
    <Screen kind="chrome">
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={handleCancel} hitSlop={touch.hitSlop} testID="edit-session-cancel" style={styles.headerSide}>
          <Text style={[typography.label, { color: colors.textSecondary }]}>Cancel</Text>
        </Pressable>
        <Text style={[typography.bodyMedium, { color: colors.text }]} maxFontSizeMultiplier={fontScaleCap.chrome}>
          Edit workout
        </Text>
        <View style={[styles.headerSide, styles.headerRight]}>
          <Pressable
            onPress={() => void handleSave()}
            disabled={!canSave}
            testID="edit-session-save"
            accessibilityRole="button"
            accessibilityLabel="Save changes"
            accessibilityState={{ disabled: !canSave }}
            style={[styles.saveBtn, { backgroundColor: canSave ? colors.primary : colors.surfaceElevated }]}
          >
            <Text style={[typography.label, { color: canSave ? colors.primaryOn : colors.textMuted }]}>Save</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: (focused ? keypadHeight : 0) + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[typography.screenTitle, { color: colors.text }]} maxFontSizeMultiplier={fontScaleCap.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[typography.caption, styles.date, { color: colors.textSecondary }]}>
          {original.completedAt ? formatEditDate(original.completedAt) : ''}
        </Text>

        {problem ? (
          <Text style={[typography.caption, styles.problem, { color: colors.danger }]} testID="edit-session-problem">
            {DRAFT_PROBLEM_COPY[problem]}
          </Text>
        ) : null}

        {draft.exercises.map((ex, exIdx) => (
          <Card key={`${ex.exerciseId}-${exIdx}`} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={[typography.sectionTitle, styles.exerciseName, { color: colors.primary }]} numberOfLines={1}>
                {exerciseName(ex.exerciseId)}
              </Text>
              <Pressable
                testID={`edit-replace-${exIdx}`}
                accessibilityRole="button"
                accessibilityLabel={`Replace ${exerciseName(ex.exerciseId)}`}
                onPress={() => openPicker({ mode: 'replace', exIdx })}
                hitSlop={touch.hitSlop}
                style={styles.iconBtn}
              >
                <Ionicons name="swap-horizontal" size={20} color={colors.textSecondary} />
              </Pressable>
              <Pressable
                testID={`edit-remove-exercise-${exIdx}`}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${exerciseName(ex.exerciseId)}`}
                onPress={() => {
                  setFocused(null);
                  setRemoveExIdx(exIdx);
                }}
                hitSlop={touch.hitSlop}
                style={styles.iconBtn}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>
            <View style={styles.row}>
              <Text style={[styles.colSet, styles.colHead, { color: colors.textMuted }]}>SET</Text>
              <Text style={[styles.colValue, styles.colHead, { color: colors.textMuted }]}>{unitLabel}</Text>
              <Text style={[styles.colValue, styles.colHead, { color: colors.textMuted }]}>REPS</Text>
              <View style={styles.colDelete} />
            </View>
            {ex.sets.map((set, setIdx) => {
              const name = `${exIdx}-${setIdx}`;
              const cell = (field: 'weight' | 'reps') => {
                const value = keypadDisplayValue(set, field, weightUnit);
                const isFocused = focused?.exIdx === exIdx && focused.setIdx === setIdx && focused.field === field;
                return (
                  <Pressable
                    testID={`edit-${field}-${name}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${field === 'weight' ? 'Weight' : 'Reps'}, set ${setLabel(ex.sets, setIdx)}`}
                    onPress={() => setFocused({ exIdx, setIdx, field, replace: true })}
                    style={[
                      styles.colValue,
                      styles.cell,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: isFocused ? colors.primary : 'transparent',
                      },
                    ]}
                  >
                    <Text style={[typography.data, { color: value == null ? colors.textMuted : colors.text }]}>
                      {value == null ? '—' : String(value)}
                    </Text>
                  </Pressable>
                );
              };
              return (
                <View key={name} style={styles.row} testID={`edit-set-${name}`}>
                  <Text style={[styles.colSet, typography.data, { color: colors.textSecondary }]}>
                    {setLabel(ex.sets, setIdx)}
                  </Text>
                  {cell('weight')}
                  {cell('reps')}
                  <Pressable
                    testID={`edit-delete-${name}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete set ${setLabel(ex.sets, setIdx)} of ${exerciseName(ex.exerciseId)}`}
                    onPress={() => deleteSet(exIdx, setIdx)}
                    hitSlop={touch.hitSlop}
                    style={styles.colDelete}
                  >
                    <Ionicons name="close" size={20} color={colors.textMuted} />
                  </Pressable>
                </View>
              );
            })}
            <Pressable
              testID={`edit-add-set-${exIdx}`}
              accessibilityRole="button"
              onPress={() => {
                setFocused(null);
                setDraft((d) => addDraftSet(d, exIdx));
              }}
              style={({ pressed }) => [styles.addSet, { borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.addSetText, { color: colors.primary }]}>+ ADD SET</Text>
            </Pressable>
          </Card>
        ))}

        <Pressable
          testID="edit-add-exercise"
          accessibilityRole="button"
          onPress={() => openPicker({ mode: 'add' })}
          style={({ pressed }) => [
            styles.addExercise,
            { backgroundColor: colors.primarySurface, borderColor: colors.primaryBorder, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
          <Text style={[styles.addExerciseText, { color: colors.primary }]}>Add Exercise</Text>
        </Pressable>
      </ScrollView>

      {focused && focusedSet ? (
        <NumericKeypad
          exerciseName={exerciseName(draft.exercises[focused.exIdx].exerciseId)}
          field={focused.field}
          unitLabel={focused.field === 'weight' ? weightUnit : ''}
          valueText={focusedValue != null ? String(focusedValue) : ''}
          step={keypadStep(focused.field, weightUnit)}
          canComplete
          onDigit={(digit) => pressKey({ kind: 'digit', digit })}
          onBackspace={() => pressKey({ kind: 'backspace' })}
          onAdjust={(delta) => pressKey({ kind: 'adjust', direction: delta < 0 ? -1 : 1 })}
          onNext={() => pressKey({ kind: 'next' })}
          onComplete={() => setFocused(null)}
          onDismiss={() => setFocused(null)}
          onHeight={setKeypadHeight}
        />
      ) : null}

      {picker ? (
        <ExercisePickerSheet
          mode={picker.mode}
          hint={
            picker.mode === 'replace'
              ? `Swapping ${exerciseName(draft.exercises[picker.exIdx]?.exerciseId ?? '')}. Its sets are kept.`
              : undefined
          }
          excludeIds={draft.exercises.map((e) => e.exerciseId)}
          search={pickerSearch}
          onSearchChange={setPickerSearch}
          onPick={pickExercise}
          onClose={closePicker}
        />
      ) : null}

      <ConfirmDialog
        visible={removeExIdx != null}
        title="Remove exercise"
        message={`Remove ${removeExIdx != null ? exerciseName(draft.exercises[removeExIdx]?.exerciseId ?? '') : ''} and its sets from this workout?`}
        cancelLabel="Cancel"
        confirmLabel="Remove"
        destructive
        onCancel={() => setRemoveExIdx(null)}
        onConfirm={() => {
          if (removeExIdx != null) setDraft((d) => removeDraftExercise(d, removeExIdx));
          setRemoveExIdx(null);
        }}
        cancelTestID="edit-remove-exercise-cancel"
        confirmTestID="edit-remove-exercise-confirm"
      />

      <ConfirmDialog
        visible={confirmDiscard}
        title="Discard changes?"
        message="The workout stays as it was in History."
        cancelLabel="Keep editing"
        confirmLabel="Discard"
        destructive
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          setLeaving({ action: heldAction.current });
        }}
        cancelTestID="edit-session-keep"
        confirmTestID="edit-session-discard"
      />
      <ConfirmDialog
        visible={saveFailed}
        title="Workout not found"
        message="This workout was deleted from History, so your changes can't be saved."
        confirmLabel="OK"
        onConfirm={() => {
          setSaveFailed(false);
          setLeaving({});
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSide: { minWidth: 72, minHeight: touch.min, justifyContent: 'center' },
  headerRight: { alignItems: 'flex-end' },
  saveBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md },
  content: { padding: spacing.lg, gap: spacing.md },
  date: { marginTop: -spacing.sm },
  problem: {},
  card: { gap: spacing.sm, paddingBottom: 0 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs },
  exerciseName: { flex: 1 },
  iconBtn: { minHeight: touch.min, minWidth: 32, alignItems: 'center', justifyContent: 'center' },
  addSet: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  addSetText: { ...typography.label, fontWeight: '600', letterSpacing: 0.5 },
  addExercise: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  addExerciseText: { fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  colHead: { ...typography.caption, letterSpacing: 0.5 },
  colSet: { width: 36, textAlign: 'center' },
  colValue: { flex: 1, textAlign: 'center' },
  cell: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colDelete: { width: 36, alignItems: 'center', justifyContent: 'center', minHeight: touch.min },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
});
