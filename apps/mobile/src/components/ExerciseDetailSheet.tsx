import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Alert,
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
import { ExerciseNoteEditor, NOTE_HINT } from '@/components/ExerciseNoteEditor';
import { MuscleDiagram } from '@/components/MuscleDiagram';
import { exerciseTypeLine } from '@/utils/exerciseLibraryFilter';
import { isCustomExerciseId } from '@/utils/exerciseIds';
import { exercisePageUrl } from '@/utils/exerciseDemo';

/** Approximate detail-sheet header (title + Close + padding + hairline). */
const DETAIL_HEADER_HEIGHT = 64;

/**
 * Exercise detail sheet: diagram, muscles, type, instructions and the user's note. The note shows
 * read-only here; tapping it swaps the sheet for the note dialog (same Modal — stacking a second
 * Modal froze iOS), which keeps the field above the keyboard. `canManage` adds Edit/Delete for customs and a link to the exercise's
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
  const [editingNote, setEditingNote] = useState(false);
  const exerciseId = exercise?.id;
  const pageUrl = exercise ? exercisePageUrl(exercise) : undefined;
  const hasHistory = useMemo(
    () =>
      canManage &&
      exerciseId != null &&
      exerciseHasHistory(completedNewestFirst(sessions), exerciseId, (id) => getExercise(id)?.id ?? id),
    [canManage, exerciseId, sessions, getExercise]
  );

  useEffect(() => {
    setEditingNote(false);
  }, [exerciseId]);

  const steps = instructionSteps(exercise?.instructions);

  const close = () => {
    setEditingNote(false);
    onClose();
  };

  const saveNote = (note: string) => {
    if (exercise) void setNote(exercise.id, note);
    setEditingNote(false);
  };

  const openHistory = () => {
    if (!exercise) return;
    const id = exercise.id;
    onClose();
    router.push({ pathname: '/exercise-progression', params: { exerciseId: id } });
  };

  return (
    <Modal
      visible={exercise !== null}
      animationType="slide"
      transparent
      onRequestClose={editingNote ? () => setEditingNote(false) : close}
    >
      {exercise && editingNote ? (
        <ExerciseNoteEditor
          exerciseName={exercise.name}
          savedNote={savedNote}
          onSave={saveNote}
          onCancel={() => setEditingNote(false)}
        />
      ) : (
      <View
        style={[
          styles.modalOverlay,
          { backgroundColor: colors.overlay, paddingTop: insets.top + spacing.sm },
        ]}
      >
        {/* Sibling backdrop — nesting ScrollView in Pressable breaks pans on Android (MUS-31). */}
        <Pressable
          style={StyleSheet.absoluteFill}
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
                <Text style={[styles.noteHint, { color: colors.textMuted }]}>{NOTE_HINT}</Text>
                <Pressable
                  onPress={() => setEditingNote(true)}
                  testID="exercise-note-edit"
                  accessibilityRole="button"
                  accessibilityLabel={savedNote ? 'Edit note' : 'Add a note'}
                  style={({ pressed }) => [
                    styles.noteRow,
                    { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={[styles.noteText, { color: savedNote ? colors.text : colors.textMuted }]}>
                    {savedNote ?? 'Add a note'}
                  </Text>
                  <Ionicons name="create-outline" size={18} color={colors.primary} />
                </Pressable>
              </ScrollView>
            </>
          ) : null}
        </SheetFrame>
      </View>
      )}
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
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  noteText: { ...typography.body, flex: 1 },
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
  customActions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
});
