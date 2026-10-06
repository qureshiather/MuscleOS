import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Modal, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { formatMuscleLabels } from '@muscleos/types';
import type { Exercise } from '@muscleos/types';
import { useTheme } from '@/theme/ThemeContext';
import { SheetFrame } from '@/components/layout';
import { useBottomSpace, useModalMaxHeight } from '@/theme/layout';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/tokens';
import { useExercisesStore } from '@/store/exercisesStore';
import { useExerciseNotesStore } from '@/store/exerciseNotesStore';
import { MuscleDiagram } from '@/components/MuscleDiagram';
import { exerciseTypeLine } from '@/utils/exerciseLibraryFilter';
import { isCustomExerciseId } from '@/utils/exerciseIds';

/** Approximate detail-sheet header (title + Close + padding + hairline). */
const DETAIL_HEADER_HEIGHT = 64;

/**
 * Exercise detail sheet: diagram, muscles, type, instructions and the user's notes. Notes save on
 * Close, backdrop tap, back, and end-editing. `canManage` adds Edit/Delete for customs — off where
 * leaving the screen or removing the exercise would be wrong (e.g. mid-workout).
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
  const sheetBottomPad = useBottomSpace(spacing.xl);
  const detailScrollMaxHeight = Math.max(160, sheetMaxHeight - sheetBottomPad - DETAIL_HEADER_HEIGHT);
  const removeExercise = useExercisesStore((s) => s.removeExercise);
  const setNote = useExerciseNotesStore((s) => s.setNote);
  const [noteDraft, setNoteDraft] = useState('');

  const exerciseId = exercise?.id;
  useEffect(() => {
    if (exerciseId) setNoteDraft(useExerciseNotesStore.getState().notes[exerciseId] ?? '');
  }, [exerciseId]);

  const close = () => {
    if (exercise) void setNote(exercise.id, noteDraft);
    onClose();
  };

  return (
    <Modal visible={exercise !== null} animationType="slide" transparent onRequestClose={close}>
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
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
                style={[styles.modalScroll, { maxHeight: detailScrollMaxHeight }]}
                contentContainerStyle={styles.modalBody}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                <MuscleDiagram muscleIds={exercise.muscles} size={0.9} />
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Muscles</Text>
                <Text style={[styles.bodyText, { color: colors.text }]}>
                  {formatMuscleLabels(exercise.muscles)}
                </Text>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Type</Text>
                <Text style={[styles.bodyText, { color: colors.text }]}>{exerciseTypeLine(exercise)}</Text>
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
                {exercise.instructions ? (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Instructions</Text>
                    <Text style={[styles.bodyText, { color: colors.text }]}>{exercise.instructions}</Text>
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
                  onEndEditing={() => void setNote(exercise.id, noteDraft)}
                  multiline
                  textAlignVertical="top"
                />
              </ScrollView>
            </>
          ) : null}
        </SheetFrame>
      </View>
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
  noteHint: { ...typography.caption, marginBottom: spacing.sm },
  noteInput: {
    ...typography.body,
    minHeight: 88,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  customActions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
});
