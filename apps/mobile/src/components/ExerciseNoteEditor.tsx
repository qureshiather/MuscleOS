import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { typography, fontFamily } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { noteSaveState } from '@/utils/noteDraft';

export const NOTE_PLACEHOLDER = 'e.g. seat 4 · lever underneath on 3';
export const NOTE_HINT = 'Seat height, lever settings, and other personal adjustments. Synced to your account.';

/**
 * Exercise note dialog. Renders full-screen content for a host `Modal` (never a Modal itself, so the
 * detail sheet can swap to it instead of stacking modals, which froze iOS). The card is pinned to
 * the top of the screen: the keyboard rises from the bottom, so it can't cover the field on either
 * platform, whatever the window does when the keyboard opens. Cancel discards the draft; Save,
 * backdrop and back save it — typed notes are never lost to a stray tap.
 */
export function ExerciseNoteEditor({
  exerciseName,
  savedNote,
  onSave,
  onCancel,
}: {
  exerciseName: string;
  savedNote: string | undefined;
  onSave: (note: string) => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(savedNote ?? '');
  const changed = noteSaveState(draft, savedNote) === 'unsaved';
  const save = () => (changed ? onSave(draft) : onCancel());

  return (
    <View
      style={[styles.overlay, { backgroundColor: colors.overlay, paddingTop: insets.top + spacing.lg }]}
      testID="exercise-note-editor"
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={save}
        accessibilityRole="button"
        accessibilityLabel="Save and close note"
      />
      <View
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow }]}
      >
        <Text style={[styles.title, { color: colors.text }]}>Exercise note</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {exerciseName}
        </Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>{NOTE_HINT}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder={NOTE_PLACEHOLDER}
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          multiline
          textAlignVertical="top"
          autoFocus
        />
        <View style={styles.actions}>
          <PrimaryButton
            label="Cancel"
            variant="outline"
            onPress={onCancel}
            style={styles.action}
            testID="exercise-note-cancel"
            accessibilityRole="button"
          />
          <PrimaryButton
            label="Save"
            onPress={save}
            disabled={!changed}
            style={styles.action}
            testID="exercise-note-save"
            accessibilityRole="button"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  title: { fontFamily: fontFamily.sansBold, fontSize: 20, lineHeight: 26 },
  subtitle: { ...typography.label, marginTop: spacing.xs },
  hint: { ...typography.caption, marginTop: spacing.sm, marginBottom: spacing.md },
  input: {
    ...typography.body,
    minHeight: 96,
    // Long notes scroll inside the field so the card (and its buttons) stay above the keyboard.
    maxHeight: 160,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  action: { flex: 1 },
});
