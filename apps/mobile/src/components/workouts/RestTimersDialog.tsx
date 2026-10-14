import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { fontScaleCap } from '@/theme/layout';
import { NumericKeypad } from '@/components/NumericKeypad';
import { formatClock } from '@/utils/formatClock';
import {
  applyRestTimeKey,
  focusRestTimeBox,
  type RestTimeEntry,
  type RestTimeKey,
} from '@/utils/keypadInput';

type RestTimersDialogProps = {
  /** The exercise being edited; the dialogue is hidden while null. */
  exerciseName: string | null;
  /** Durations the boxes open with, in seconds. */
  initial: { work: number; warmUp: number };
  hint: string;
  onSave: (work: number, warmUp: number) => void;
  onClose: () => void;
};

/**
 * **Update rest timers**: the work-set and warm-up rest for one exercise, each a time box entered
 * with the time keypad (docked under the card while a box is focused). Used during a workout and
 * in the template editor.
 */
export function RestTimersDialog({ exerciseName, initial, hint, onSave, onClose }: RestTimersDialogProps) {
  const { colors } = useTheme();
  const visible = exerciseName != null;
  const [entry, setEntry] = useState<RestTimeEntry>({ ...initial, field: null, replace: true });

  // Each opening starts from the exercise's current rests.
  useEffect(() => {
    if (visible) setEntry({ work: initial.work, warmUp: initial.warmUp, field: null, replace: true });
  }, [visible, initial.work, initial.warmUp]);

  const field = entry.field;
  const press = (key: RestTimeKey) => setEntry((e) => applyRestTimeKey(e, key));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={[styles.overlay, { backgroundColor: colors.overlay }, field != null && styles.docked]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={field != null ? styles.dock : undefined} onStartShouldSetResponder={() => true}>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
              field != null && styles.cardDocked,
            ]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.title, { color: colors.text }]}>Update rest timers</Text>
            <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text>
            {(
              [
                ['work', 'Work set', entry.work],
                ['warmUp', 'Warm up', entry.warmUp],
              ] as const
            ).map(([box, label, seconds]) => (
              <View key={box} style={styles.typeRow}>
                <Text style={[styles.typeLabel, { color: colors.text }]}>{label}</Text>
                <Pressable
                  onPress={() => setEntry((e) => focusRestTimeBox(e, box))}
                  accessibilityRole="button"
                  accessibilityLabel={`${label} rest ${formatClock(seconds)}`}
                  testID={`rest-time-${box}`}
                  accessibilityHint="Enter a time"
                  style={[
                    styles.pill,
                    { borderColor: field === box ? colors.primary : colors.border, backgroundColor: colors.surface },
                  ]}
                >
                  <Text style={[styles.pillText, { color: colors.text }]} maxFontSizeMultiplier={fontScaleCap.chrome}>
                    {formatClock(seconds)}
                  </Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
              testID="rest-timers-save"
              onPress={() => onSave(entry.work, entry.warmUp)}
            >
              <Text style={[styles.saveBtnText, { color: colors.primaryOn }]}>Update rest timers</Text>
            </Pressable>
          </View>
          {field != null ? (
            <NumericKeypad
              inline
              exerciseName={exerciseName ?? ''}
              field="time"
              fieldTitle={field === 'work' ? 'Work set' : 'Warm up'}
              timeAction={field === 'work' ? 'next' : 'done'}
              unitLabel=""
              valueText={formatClock(field === 'work' ? entry.work : entry.warmUp)}
              step={1}
              canComplete
              onDigit={(digit) => press({ kind: 'digit', digit })}
              onBackspace={() => press({ kind: 'backspace' })}
              onAdjust={() => {}}
              onNext={() => press({ kind: 'next' })}
              onComplete={() => press({ kind: 'done' })}
              onDismiss={() => press({ kind: 'done' })}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  docked: { justifyContent: 'flex-end', alignItems: 'stretch', padding: 0 },
  dock: { width: '100%' },
  card: { width: '100%', maxWidth: 320, borderRadius: 16, borderWidth: 1, padding: 20 },
  cardDocked: { alignSelf: 'center', marginBottom: 12 },
  title: { ...typography.sectionTitle, marginBottom: 4 },
  hint: { ...typography.caption, marginBottom: 8, lineHeight: 18 },
  typeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  typeLabel: { fontSize: 16, fontWeight: '500' },
  pill: {
    minWidth: 76,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  pillText: {
    fontFamily: typography.data.fontFamily,
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  saveBtn: { marginTop: 12, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  saveBtnText: { ...typography.button },
});
