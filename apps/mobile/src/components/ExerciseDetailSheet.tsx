import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMuscleLabels, instructionSteps } from '@muscleos/types';
import type { Exercise } from '@muscleos/types';
import { useTheme } from '@/theme/ThemeContext';
import { SheetFrame } from '@/components/layout';
import { useBottomSpace, useModalMaxHeight } from '@/theme/layout';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/tokens';
import { useExercisesStore } from '@/store/exercisesStore';
import { useExerciseNotesStore } from '@/store/exerciseNotesStore';
import { completedNewestFirst, useSessionsStore } from '@/store/sessionsStore';
import { exerciseHasHistory } from '@/utils/personalRecords';
import { noteSaveState } from '@/utils/noteDraft';
import { MuscleDiagram } from '@/components/MuscleDiagram';
import { exerciseTypeLine } from '@/utils/exerciseLibraryFilter';
import { isCustomExerciseId } from '@/utils/exerciseIds';
import { exercisePageUrl } from '@/utils/exerciseDemo';

/** Approximate detail-sheet header (title + Close + padding + hairline). */
const DETAIL_HEADER_HEIGHT = 64;

/**
 * Exercise detail sheet: diagram, muscles, type, instructions and the user's notes. Notes save on
 * Save, Close, backdrop tap, back, and end-editing; the sheet rises with the keyboard so the note
 * stays visible while typing. `canManage` adds Edit/Delete for customs and a link to the exercise's
 * history — off where leaving the screen or removing the exercise would be wrong (e.g. mid-workout).
 * Catalog exercises link to their page on the website (an animated demo where one exists); that
 * opens in the in-app browser over the sheet, so it's offered everywhere, mid-workout included.
 */
export function ExerciseDetailSheet({
  exercise,
  onClose,
  canManage = false,
}: {
  exercise: Exercise | null;
  onClose: () => void;
  canManage?: boolean;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const sheetMaxHeight = useModalMaxHeight();
  const insets = useSafeAreaInsets();
  const sheetBottomPad = useBottomSpace(spacing.xl);
  const detailScrollMaxHeight = Math.max(160, sheetMaxHeight - sheetBottomPad - DETAIL_HEADER_HEIGHT);
  const removeExercise = useExercisesStore((s) => s.removeExercise);
  const setNote = useExerciseNotesStore((s) => s.setNote);
  const savedNote = useExerciseNotesStore((s) => (exercise ? s.notes[exercise.id] : undefined));
  const sessions = useSessionsStore((s) => s.sessions);
  const getExercise = useExercisesStore((s) => s.getExercise);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteFocused, setNoteFocused] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const saveState = noteSaveState(noteDraft, savedNote);
  const exerciseId = exercise?.id;
  const pageUrl = exercise ? exercisePageUrl(exercise) : undefined;
  const hasHistory = useMemo(
    () =>
      canManage &&
      exerciseId != null &&
      exerciseHasHistory(completedNewestFirst(sessions), exerciseId, (id) => getExercise(id)?.id ?? id),
    [canManage, exerciseId, sessions, getExercise]
  );

  // The note sits at the bottom of the sheet: once the keyboard is up (and the sheet has risen
  // above it), scroll so the field stays in view while typing.
  useEffect(() => {
    if (!noteFocused) return;
    const sub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    });
    return () => sub.remove();
  }, [noteFocused]);

  useEffect(() => {
    if (exerciseId) setNoteDraft(useExerciseNotesStore.getState().notes[exerciseId] ?? '');
  }, [exerciseId]);

  const steps = instructionSteps(exercise?.instructions);

  const close = () => {
    if (exercise) void setNote(exercise.id, noteDraft);
    onClose();
  };

  const saveNote = () => {
    if (exercise) void setNote(exercise.id, noteDraft);
    Keyboard.dismiss();
  };

  const openHistory = () => {
    if (!exercise) return;
    const id = exercise.id;
    void setNote(id, noteDraft);
    onClose();
    router.push({ pathname: '/exercise-progression', params: { exerciseId: id } });
  };

  return (
    <Modal visible={exercise !== null} animationType="slide" transparent onRequestClose={close}>
      {/* Top inset: lifted by the keyboard, the sheet shrinks (its body scrolls) rather than
          rising under the status bar. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.modalOverlay,
          { backgroundColor: colors.overlay, paddingTop: insets.top + spacing.sm },
        ]}
      >
        {/* Sibling backdrop — nesting ScrollView in Pressable breaks pans on Android (MUS-31). */}
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Dismiss exercise details"
        />
        <SheetFrame style={styles.sheet}>
          {exercise ? (
            <>
              <View
                style={[
                  styles.modalHeader,
                  { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <Text style={[styles.modalTitle, { color: colors.text }]}>{exercise.name}</Text>
                <Pressable onPress={close} hitSlop={8}>
                  <Text style={[styles.modalClose, { color: colors.primary }]}>Close</Text>
                </Pressable>
              </View>
              <ScrollView
                ref={scrollRef}
                style={[styles.modalScroll, { maxHeight: detailScrollMaxHeight }]}
                contentContainerStyle={styles.modalBody}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                <MuscleDiagram muscleIds={exercise.muscles} size={0.9} />
                {pageUrl ? (
                  <Pressable
                    onPress={() => void WebBrowser.openBrowserAsync(pageUrl)}
                    testID="exercise-detail-demo"
                    accessibilityRole="link"
                    accessibilityLabel={`See how to do ${exercise.name}`}
                    accessibilityHint="Opens the exercise's page on muscleos.app"
                    style={({ pressed }) => [
                      styles.historyRow,
                      { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Ionicons name="play-circle-outline" size={18} color={colors.primary} />
                    <Text style={[styles.historyText, { color: colors.primary }]}>See how it&apos;s done</Text>
                    <Ionicons name="open-outline" size={16} color={colors.textMuted} />
                  </Pressable>
                ) : null}
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Muscles</Text>
                <Text style={[styles.bodyText, { color: colors.text }]}>
                  {formatMuscleLabels(exercise.muscles)}
                </Text>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Type</Text>
                <Text style={[styles.bodyText, { color: colors.text }]}>{exerciseTypeLine(exercise)}</Text>
                {hasHistory ? (
                  <Pressable
                    onPress={openHistory}
                    testID="exercise-detail-history"
                    accessibilityRole="link"
                    accessibilityLabel={`View ${exercise.name} history`}
                    style={({ pressed }) => [
                      styles.historyRow,
                      { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Ionicons name="stats-chart-outline" size={18} color={colors.primary} />
                    <Text style={[styles.historyText, { color: colors.primary }]}>View history</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                ) : null}
                {canManage && isCustomExerciseId(exercise.id) ? (
                  <View style={styles.customActions}>
                    <Pressable
                      onPress={() => {
                        const id = exercise.id;
                        void setNote(id, noteDraft);
                        onClose();
                        router.push({ pathname: '/create-exercise', params: { id } });
                      }}
                    >
                      <Text style={[styles.modalClose, { color: colors.primary }]}>Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        Alert.alert(
                          'Delete exercise',
                          `Remove ${exercise.name} from your account? Past workouts keep the name if you logged it.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => {
                                void removeExercise(exercise.id);
                                onClose();
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <Text style={[styles.modalClose, { color: colors.danger }]}>Delete</Text>
                    </Pressable>
                  </View>
                ) : null}
                {steps.length > 0 ? (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Instructions</Text>
                    {steps.length === 1 ? (
                      <Text style={[styles.bodyText, { color: colors.text }]}>{steps[0]}</Text>
                    ) : (
                      steps.map((step, i) => (
                        <View key={`${i}-${step}`} style={styles.stepRow}>
                          <Text style={[styles.bodyText, styles.stepNumber, { color: colors.textSecondary }]}>
                            {i + 1}.
                          </Text>
                          <Text style={[styles.bodyText, styles.stepText, { color: colors.text }]}>{step}</Text>
                        </View>
                      ))
                    )}
                  </>
                ) : null}
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Your notes</Text>
                <Text style={[styles.noteHint, { color: colors.textMuted }]}>
                  Seat height, lever settings, and other personal adjustments. Synced to your account.
                </Text>
                <TextInput
                  style={[
                    styles.noteInput,
                    { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
                  ]}
                  placeholder="e.g. seat 4 · lever underneath on 3"
                  placeholderTextColor={colors.textMuted}
                  value={noteDraft}
                  onChangeText={setNoteDraft}
                  onFocus={() => setNoteFocused(true)}
                  onBlur={() => setNoteFocused(false)}
                  onEndEditing={() => void setNote(exercise.id, noteDraft)}
                  multiline
                  textAlignVertical="top"
                />
                <View style={styles.noteActions}>
                  {saveState === 'saved' ? (
                    <Text style={[styles.noteSavedText, { color: colors.textMuted }]}>Saved</Text>
                  ) : null}
                  {saveState === 'unsaved' ? (
                    <Pressable
                      onPress={saveNote}
                      testID="exercise-note-save"
                      accessibilityRole="button"
                      accessibilityLabel="Save note"
                      style={({ pressed }) => [
                        styles.noteSaveBtn,
                        { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                      ]}
                    >
                      <Text style={[styles.noteSaveText, { color: colors.primaryOn }]}>Save</Text>
                    </Pressable>
                  ) : null}
                </View>
              </ScrollView>
            </>
          ) : null}
        </SheetFrame>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    flexShrink: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg + 4,
  },
  modalTitle: { ...typography.sectionTitle, flex: 1 },
  modalClose: { ...typography.label },
  modalScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  modalBody: { padding: spacing.lg + 4, paddingTop: spacing.md },
  sectionLabel: {
    ...typography.caption,
    fontFamily: typography.label.fontFamily,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  bodyText: { ...typography.body },
  stepRow: { flexDirection: 'row', marginBottom: spacing.xs },
  stepNumber: { width: 24 },
  stepText: { flex: 1 },
  noteHint: { ...typography.caption, marginBottom: spacing.sm },
  noteInput: {
    ...typography.body,
    minHeight: 88,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  historyText: { ...typography.label, flex: 1 },
  noteActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    minHeight: 36,
    marginTop: spacing.sm,
  },
  noteSavedText: { ...typography.caption },
  noteSaveBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  noteSaveText: { ...typography.label },
  customActions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
});
