import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { typography, fontFamily } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { fontScaleCap, useModalMaxHeight } from '@/theme/layout';

type RecoveryInfoModalProps = {
  visible: boolean;
  onClose: () => void;
  /** When the "not natty" setting is on, recovery times are halved. */
  notNatty?: boolean;
};

type InfoPoint = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

const POINTS: InfoPoint[] = [
  {
    icon: 'body-outline',
    title: 'Tracked per muscle group',
    body: 'Every muscle group recovers on its own timer. Log a workout and the muscles it hit are marked as recovering until their timer runs out, then they turn ready again.',
  },
  {
    icon: 'time-outline',
    title: 'Some recover faster',
    body: 'Smaller muscles bounce back quicker. Biceps, triceps and abs are ready in about 36 hours; shoulders and calves around 48; big movers like chest, back and legs take about 72.',
  },
  {
    icon: 'color-palette-outline',
    title: 'Reading the map',
    body: 'Red is just trained, amber is still recovering, and green means it’s ready to train again.',
  },
];

/** Explains the recovery model — opened from the help icon on the Recovery tab. */
export function RecoveryInfoModal({ visible, onClose, notNatty }: RecoveryInfoModalProps) {
  const { colors } = useTheme();
  const maxHeight = useModalMaxHeight();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, maxHeight }]}
          accessibilityRole="alert"
          accessibilityLabel="How recovery works"
        >
          <View style={styles.header}>
            <Text
              style={[styles.title, { color: colors.text }]}
              maxFontSizeMultiplier={fontScaleCap.chrome}
            >
              How recovery works
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {POINTS.map((point) => (
              <View key={point.title} style={styles.point}>
                <View style={[styles.iconWrap, { backgroundColor: colors.primarySurface }]}>
                  <Ionicons name={point.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.pointText}>
                  <Text style={[typography.body, styles.pointTitle, { color: colors.text }]}>
                    {point.title}
                  </Text>
                  <Text style={[typography.caption, styles.pointBody, { color: colors.textSecondary }]}>
                    {point.body}
                  </Text>
                </View>
              </View>
            ))}
            {notNatty ? (
              <View style={[styles.note, { borderColor: colors.border }]}>
                <Ionicons name="flash-outline" size={16} color={colors.textMuted} />
                <Text style={[typography.caption, styles.noteText, { color: colors.textMuted }]}>
                  Enhanced recovery is on, so every timer is halved.
                </Text>
              </View>
            ) : null}
          </ScrollView>
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
    maxWidth: 360,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.sansBold,
    fontSize: 20,
    lineHeight: 26,
  },
  closeBtn: { marginLeft: spacing.sm },
  closeBtnPressed: { opacity: 0.6 },
  scroll: { flexGrow: 0 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  point: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointText: { flex: 1, minWidth: 0 },
  pointTitle: { fontFamily: fontFamily.sansMedium, marginBottom: spacing.xs / 2 },
  pointBody: { lineHeight: 19 },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    borderTopWidth: 1,
    paddingTop: spacing.md,
  },
  noteText: { flex: 1, lineHeight: 18 },
});
