import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { fontScaleCap, useBottomSpace } from '@/theme/layout';

export type KeypadField = 'weight' | 'reps' | 'time';

interface NumericKeypadProps {
  /** Exercise being edited — shown small so you know where the number is going. */
  exerciseName: string;
  field: KeypadField;
  /** Shown in place of Weight/Reps. Used for a time field ("Work set", "Warm up"). */
  fieldTitle?: string;
  /** Time field only: Next advances to the other duration; Done hides the pad. */
  timeAction?: 'next' | 'done';
  /** Sit in document flow (inside a sheet) instead of docking over the screen. */
  inline?: boolean;
  /** 'lb' / 'kg' for weight, '' for reps. */
  unitLabel: string;
  /** Current display value, '' when empty. */
  valueText: string;
  /** Step for the −/+ keys in the field's own unit (2.5 kg, 5 lb, or 1 rep). */
  step: number;
  /** Whether the reps field holds a completable value (reps > 0). Gates the Done key. */
  canComplete: boolean;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onAdjust: (delta: number) => void;
  /** Weight: advance to reps. */
  onNext: () => void;
  /** Reps: complete the set and start rest. */
  onComplete: () => void;
  onDismiss: () => void;
  /** Reports rendered height so the list can reserve room to scroll above it. */
  onHeight?: (height: number) => void;
}

const KEY_HEIGHT = 50;
const GRID_GAP = 7;

/**
 * In-app number pad for logging sets. Docked to the bottom, whole numbers only. It replaces
 * the OS keyboard entirely, so it never covers the sets you're editing and a set completes on
 * the first tap. The action column adapts to the field:
 *
 * - **Weight** → a reserved plate-calculator slot and a primary **Next** (jumps to reps).
 * - **Reps** → a reserved **RPE** slot and a success **Done** that finishes the set and rests.
 */
export function NumericKeypad({
  exerciseName,
  field,
  fieldTitle,
  timeAction = 'done',
  inline = false,
  unitLabel,
  valueText,
  step,
  canComplete,
  onDigit,
  onBackspace,
  onAdjust,
  onNext,
  onComplete,
  onDismiss,
  onHeight,
}: NumericKeypadProps) {
  const { colors, isDark } = useTheme();
  const bottomInset = useBottomSpace(10);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const isWeight = field === 'weight';
  const isTime = field === 'time';
  const fieldLabel = fieldTitle ?? (isWeight ? 'Weight' : isTime ? 'Time' : 'Reps');
  const showNext = isWeight || (isTime && timeAction === 'next');
  const keyFace = isDark ? colors.surface : colors.surfaceElevated;
  // Third utility slot is reserved for a per-field power feature we haven't built yet.
  const reservedLabel = isWeight ? 'Plates' : 'RPE';

  const numberKey = (digit: string) => (
    <KeypadKey
      key={digit}
      onPress={() => onDigit(digit)}
      background={keyFace}
      border={colors.border}
      accessibilityLabel={digit}
    >
      <Text style={[styles.digit, { color: colors.text }]} maxFontSizeMultiplier={fontScaleCap.fixed}>
        {digit}
      </Text>
    </KeypadKey>
  );

  return (
    <Animated.View
      onLayout={(e) => onHeight?.(e.nativeEvent.layout.height)}
      style={[
        styles.root,
        inline && styles.inline,
        {
          backgroundColor: colors.surfaceElevated,
          borderTopColor: colors.border,
          paddingBottom: bottomInset,
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }),
            },
          ],
        },
      ]}
    >
      {/* Context bar — what you're editing and its running value. */}
      <View style={styles.contextBar}>
        <View style={styles.contextLeft}>
          <Text style={[styles.contextExercise, { color: colors.textMuted }]} numberOfLines={1}>
            {exerciseName}
          </Text>
          <Text style={[styles.contextField, { color: colors.textSecondary }]} numberOfLines={1}>
            {fieldLabel}
            {unitLabel ? ` · ${unitLabel}` : ''}
          </Text>
        </View>
        <Text style={[styles.contextValue, { color: colors.text }]} maxFontSizeMultiplier={fontScaleCap.chrome}>
          {valueText || '0'}
        </Text>
      </View>

      <View style={styles.grid}>
        {/* Number column: 1–9, then 0 and reserved Plates/RPE. */}
        <View style={styles.numberColumn}>
          <View style={styles.gridRow}>{['1', '2', '3'].map(numberKey)}</View>
          <View style={styles.gridRow}>{['4', '5', '6'].map(numberKey)}</View>
          <View style={styles.gridRow}>{['7', '8', '9'].map(numberKey)}</View>
          <View style={styles.gridRow}>
            <View style={styles.keyCell} />
            {numberKey('0')}
            {/* Reserved: plate calculator (weight) / RPE effort (reps). Time entry has neither. */}
            <View style={styles.keyCell}>
              {isTime ? null : (
                <View
                  style={[
                    styles.reservedKey,
                    { backgroundColor: keyFace, borderColor: colors.border, opacity: 0.5 },
                  ]}
                >
                  <Text style={[styles.reservedLabel, { color: colors.textMuted }]}>{reservedLabel}</Text>
                  <Text style={[styles.reservedSoon, { color: colors.textMuted }]}>soon</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Utility column: dismiss · − / + · backspace · action. */}
        <View style={styles.utilityColumn}>
          <View style={styles.keyCell}>
            <KeypadKey
              onPress={onDismiss}
              background={keyFace}
              border={colors.border}
              accessibilityLabel="Hide keypad"
            >
              <Ionicons name="chevron-down" size={22} color={colors.textSecondary} />
            </KeypadKey>
          </View>

          <View style={styles.keyCell}>
            {isTime ? null : (
              <View style={[styles.adjustPair, { backgroundColor: keyFace, borderColor: colors.border }]}>
                <Pressable
                  onPress={() => onAdjust(-step)}
                  style={styles.adjustHalf}
                  accessibilityRole="button"
                  accessibilityLabel={`Decrease ${step}`}
                >
                  <Ionicons name="remove" size={22} color={colors.text} />
                </Pressable>
                <View style={[styles.adjustDivider, { backgroundColor: colors.border }]} />
                <Pressable
                  onPress={() => onAdjust(step)}
                  style={styles.adjustHalf}
                  accessibilityRole="button"
                  accessibilityLabel={`Increase ${step}`}
                >
                  <Ionicons name="add" size={22} color={colors.text} />
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.keyCell}>
            <KeypadKey
              onPress={onBackspace}
              onLongPress={onBackspace}
              background={keyFace}
              border={colors.border}
              accessibilityLabel="Delete"
            >
              <Ionicons name="backspace-outline" size={24} color={colors.text} />
            </KeypadKey>
          </View>

          <View style={styles.keyCell}>
            {showNext ? (
              <KeypadKey onPress={onNext} background={colors.primary} accessibilityLabel="Next field">
                <Text style={[styles.actionLabel, { color: colors.primaryOn }]}>NEXT</Text>
              </KeypadKey>
            ) : (
              <KeypadKey
                onPress={onComplete}
                disabled={!canComplete}
                background={colors.success}
                accessibilityLabel={isTime ? 'Done' : 'Complete set'}
              >
                <View style={styles.doneInner}>
                  <Ionicons name="checkmark" size={20} color={colors.successOn} />
                  <Text style={[styles.actionLabel, { color: colors.successOn }]}>DONE</Text>
                </View>
              </KeypadKey>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

function KeypadKey({
  children,
  onPress,
  onLongPress,
  background,
  border,
  disabled,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress: () => void;
  onLongPress?: () => void;
  background: string;
  border?: string;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={disabled ? { disabled: true } : undefined}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.key,
        {
          backgroundColor: background,
          borderColor: border ?? 'transparent',
          borderWidth: border ? StyleSheet.hairlineWidth : 0,
          opacity: disabled ? 0.4 : pressed ? 0.55 : 1,
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 16,
  },
  inline: {
    position: 'relative',
    left: undefined,
    right: undefined,
    bottom: undefined,
  },
  contextBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 12,
  },
  contextLeft: { flex: 1, gap: 1 },
  contextExercise: { ...typography.caption, fontSize: 12 },
  contextField: {
    fontFamily: typography.label.fontFamily,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  contextValue: {
    fontFamily: typography.dataLarge.fontFamily,
    fontSize: 26,
    letterSpacing: -0.5,
  },
  grid: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
  numberColumn: { flex: 3, gap: GRID_GAP },
  utilityColumn: { flex: 1.12, gap: GRID_GAP },
  gridRow: { flexDirection: 'row', gap: GRID_GAP },
  keyCell: { flex: 1, height: KEY_HEIGHT },
  key: {
    flex: 1,
    height: KEY_HEIGHT,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontFamily: typography.dataLarge.fontFamily,
    fontSize: 24,
    letterSpacing: -0.5,
  },
  adjustPair: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  adjustHalf: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  adjustDivider: { width: StyleSheet.hairlineWidth },
  reservedKey: {
    flex: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  reservedLabel: {
    fontFamily: typography.label.fontFamily,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  reservedSoon: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  doneInner: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  actionLabel: {
    fontFamily: typography.button.fontFamily,
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
