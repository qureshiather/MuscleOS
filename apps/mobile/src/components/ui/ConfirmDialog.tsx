import { Modal, Pressable, Text, View, StyleSheet, Platform } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { typography, fontFamily } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { fontScaleCap } from '@/theme/layout';
import { PrimaryButton } from './PrimaryButton';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  /** Optional fact line under the title (elapsed time, set count, …). */
  meta?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Which action is danger. `true` means the confirm action (Keep / Discard). */
  destructive?: boolean | 'cancel' | 'confirm';
  onConfirm: () => void;
  onCancel?: () => void;
  /** Overlay / back. Defaults to `onCancel`, then `onConfirm`. */
  onDismiss?: () => void;
  confirmTestID?: string;
  cancelTestID?: string;
};

/** Centered confirm card — used instead of system `Alert.alert` for in-app decisions.
 *  Destructive confirm: stay action is filled, confirm is danger.
 *  Destructive cancel: cancel is danger, confirm is the filled primary.
 *  Otherwise confirm is the filled primary.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  meta,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
  onDismiss,
  confirmTestID,
  cancelTestID,
}: ConfirmDialogProps) {
  const { colors } = useTheme();
  const destructiveSide =
    destructive === true || destructive === 'confirm'
      ? 'confirm'
      : destructive === 'cancel'
        ? 'cancel'
        : null;
  const handleDismiss = onDismiss ?? onCancel ?? onConfirm;
  const cancelVariant =
    destructiveSide === 'cancel' ? 'danger' : destructiveSide === 'confirm' ? 'filled' : 'outline';
  const confirmVariant = destructiveSide === 'confirm' ? 'danger' : 'filled';
  const showCancel = Boolean(cancelLabel && onCancel);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="alert"
          accessibilityLabel={title}
        >
          <Text
            style={[styles.title, { color: colors.text }]}
            maxFontSizeMultiplier={fontScaleCap.chrome}
          >
            {title}
          </Text>
          {meta ? (
            <Text
              style={[styles.meta, { color: colors.textSecondary }]}
              maxFontSizeMultiplier={fontScaleCap.chrome}
            >
              {meta}
            </Text>
          ) : null}
          <Text
            style={[styles.message, { color: colors.textMuted }]}
            maxFontSizeMultiplier={fontScaleCap.chrome}
          >
            {message}
          </Text>
          <View style={styles.actions}>
            {showCancel ? (
              <PrimaryButton
                label={cancelLabel!}
                variant={cancelVariant}
                onPress={onCancel}
                testID={cancelTestID}
                accessibilityRole="button"
                accessibilityLabel={cancelLabel}
              />
            ) : null}
            <PrimaryButton
              label={confirmLabel}
              variant={confirmVariant}
              onPress={onConfirm}
              testID={confirmTestID}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  title: {
    fontFamily: fontFamily.sansBold,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  meta: {
    ...typography.data,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  actions: {
    gap: spacing.sm,
  },
});
