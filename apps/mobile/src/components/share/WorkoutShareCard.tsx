import { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MuscleId } from '@muscleos/types';
import { MuscleDiagram } from '@/components/MuscleDiagram';
import { DarkThemeScope, useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/tokens';
import { withAlpha } from '@/theme/palette';
import { SHARE_CARD_URL, type ShareCardModel } from '@/utils/shareCard';

/** Logical size of the card: 9:16, so a 3× capture is a 1080×1920 story image. */
export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT = 640;

type Props = { model: ShareCardModel; muscleIds: MuscleId[] };

/**
 * The image a workout is shared as. Always drawn in the dark palette and at a fixed size, so every
 * share looks the same whatever the device or theme. Content comes from `shareCardModel()`.
 * Spec: docs/features/history-analytics.md#sharing-a-workout
 */
export const WorkoutShareCard = forwardRef<View, Props>(function WorkoutShareCard(props, ref) {
  return (
    <DarkThemeScope>
      <CardBody {...props} innerRef={ref} />
    </DarkThemeScope>
  );
});

function CardBody({ model, muscleIds, innerRef }: Props & { innerRef: React.Ref<View> }) {
  const { colors } = useTheme();
  return (
    <View
      ref={innerRef}
      collapsable={false}
      style={[styles.card, { backgroundColor: colors.background }]}
      testID="share-card"
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {model.title}
        </Text>
        <Text style={[styles.date, { color: colors.textSecondary }]}>{model.date}</Text>
      </View>

      <View style={[styles.stats, { borderColor: colors.border }]}>
        {model.stats.map((s) => (
          <View key={s.label} style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {s.value}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {muscleIds.length > 0 ? (
        <View style={styles.diagram}>
          <MuscleDiagram sessionMuscleIds={muscleIds} size={0.7} />
        </View>
      ) : (
        <View style={styles.spacer} />
      )}

      <View style={styles.lifts}>
        {model.lifts.map((lift) => (
          <View key={lift.exerciseId} style={styles.liftRow}>
            <Text style={[styles.liftName, { color: colors.text }]} numberOfLines={1}>
              {lift.name}
            </Text>
            {lift.isPR ? (
              <View style={[styles.pr, { backgroundColor: withAlpha(colors.warning, 0.16) }]}>
                <Ionicons name="trophy" size={10} color={colors.warning} />
                <Text style={[styles.prText, { color: colors.warning }]}>PR</Text>
              </View>
            ) : null}
            <Text style={[styles.liftSet, { color: colors.textSecondary }]} numberOfLines={1}>
              {lift.bestSet}
            </Text>
          </View>
        ))}
        {model.moreCount > 0 ? (
          <Text style={[styles.more, { color: colors.textMuted }]}>+{model.moreCount} more</Text>
        ) : null}
      </View>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Image source={require('../../../assets/icon.png')} style={styles.logo} />
        <Text style={[styles.brand, { color: colors.text }]}>MuscleOS</Text>
        <Text style={[styles.url, { color: colors.primary }]}>{SHARE_CARD_URL}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    padding: spacing.lg,
    // Square: rounded corners would come out transparent in the PNG. The preview frame rounds it.
  },
  header: { marginBottom: spacing.md },
  title: { ...typography.screenTitle, fontSize: 30, lineHeight: 36 },
  date: { ...typography.body, marginTop: 2 },
  stats: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { ...typography.sectionTitle, fontFamily: typography.data.fontFamily },
  statLabel: { ...typography.caption, marginTop: 2 },
  // The diagram takes the free height, so a short workout doesn't leave a gap above the footer.
  diagram: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  spacer: { flex: 1 },
  lifts: { marginVertical: spacing.md, gap: 6 },
  liftRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liftName: { ...typography.label, flexShrink: 1 },
  liftSet: { ...typography.label, fontFamily: typography.data.fontFamily, marginLeft: 'auto' },
  pr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  prText: { fontSize: 10, fontWeight: '700' },
  more: { ...typography.caption },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  logo: { width: 22, height: 22, borderRadius: 5 },
  brand: { ...typography.label },
  url: { ...typography.caption, marginLeft: 'auto' },
});
