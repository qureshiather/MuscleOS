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
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  confirmTestID?: string;
  cancelTestID?: string;
};

/** Centered confirm card — used instead of system `Alert.alert` for in-app decisions. */
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
  confirmTestID,
  cancelTestID,
}: ConfirmDialogProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
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
            <PrimaryButton
              label={cancelLabel}
              variant="filled"
              onPress={onCancel}
              testID={cancelTestID}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
            />
            <PrimaryButton
              label={confirmLabel}
              variant={destructive ? 'danger' : 'outline'}
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
