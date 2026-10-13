import { useRef, useState } from 'react';
import { Modal, PixelRatio, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import type { MuscleId } from '@muscleos/types';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/tokens';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import type { ShareCardModel } from '@/utils/shareCard';
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH, WorkoutShareCard } from './WorkoutShareCard';

/** The shared PNG: a 9:16 story image. */
export const SHARE_IMAGE_WIDTH_PX = 1080;
export const SHARE_IMAGE_HEIGHT_PX = 1920;

/**
 * Preview of the shareable workout image, with Share (OS share sheet) and Close. The card is
 * rendered at its real size and scaled to fit, so the capture is always 1080×1920.
 * Spec: docs/features/history-analytics.md#sharing-a-workout
 */
export function ShareWorkoutSheet({
  model,
  muscleIds,
  onClose,
}: {
  /** Null hides the sheet. */
  model: ShareCardModel | null;
  muscleIds: MuscleId[];
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Leave room for the buttons below the preview.
  const scale = Math.min(
    1,
    (width - spacing.lg * 2) / SHARE_CARD_WIDTH,
    (height - insets.top - insets.bottom - 160) / SHARE_CARD_HEIGHT
  );

  async function share() {
    if (!cardRef.current) return;
    setSharing(true);
    setError(null);
    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        result: 'tmpfile',
        // view-shot scales these by the screen density, so divide it out: always 1080×1920 px.
        width: SHARE_IMAGE_WIDTH_PX / PixelRatio.get(),
        height: SHARE_IMAGE_HEIGHT_PX / PixelRatio.get(),
      });
      if (!(await Sharing.isAvailableAsync())) {
        setError("Sharing isn't available on this device.");
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share workout', UTI: 'public.png' });
    } catch {
      setError("Couldn't create the image. Try again.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <Modal visible={model != null} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={[
          styles.overlay,
          { backgroundColor: colors.background, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md },
        ]}
      >
        {model ? (
          <View
            // The outline frames the preview only; the captured card has no border.
            style={[
              styles.preview,
              { width: SHARE_CARD_WIDTH * scale + 2, height: SHARE_CARD_HEIGHT * scale + 2, borderColor: colors.border },
            ]}
            accessibilityLabel={`Share image for ${model.title}`}
          >
            <View style={{ transform: [{ scale }], transformOrigin: 'top left' }}>
              <WorkoutShareCard ref={cardRef} model={model} muscleIds={muscleIds} />
            </View>
          </View>
        ) : null}
        {error ? <Text style={[typography.caption, styles.error, { color: colors.danger }]}>{error}</Text> : null}
        <View style={styles.actions}>
          <PrimaryButton label="Close" variant="outline" onPress={onClose} style={styles.action} testID="share-close" />
          <PrimaryButton
            label={sharing ? 'Preparing…' : 'Share'}
            onPress={share}
            disabled={sharing}
            style={styles.action}
            testID="share-confirm"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  preview: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  error: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, alignSelf: 'stretch' },
  action: { flex: 1 },
});
