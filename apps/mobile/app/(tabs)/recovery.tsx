import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { Screen } from '@/components/layout';
import { screenHeaderStyles } from '@/theme/screenHeader';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useRecoveryStore } from '@/store/recoveryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { MUSCLE_GROUPS, muscleLabel } from '@muscleos/types';
import type { MuscleId } from '@muscleos/types';
import { MuscleDiagram } from '@/components/MuscleDiagram';
import { RecoveryInfoModal } from '@/components/RecoveryInfoModal';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatRecoveryReady } from '@/utils/relativeTime';
import { getRecoveryUntil } from '@muscleos/types';
import { justTrainedMuscleIds } from '@/utils/recovery';
import { fontScaleCap } from '@/theme/layout';

const ALL_MUSCLE_IDS: MuscleId[] = Object.keys(MUSCLE_GROUPS) as MuscleId[];

export default function RecoveryScreen() {
  const { colors } = useTheme();
  const ensureLoaded = useRecoveryStore((s) => s.ensureLoaded);
  const activeRecovery = useRecoveryStore((s) => s.activeRecovery);
  const isLoading = useRecoveryStore((s) => s.isLoading);
  const profile = useSettingsStore((s) => s.profile);
  const diagramVariant = profile?.sex === 'female' ? 'female' : 'male';
  const [infoVisible, setInfoVisible] = useState(false);
  // Recovery is recomputed by whatever changes sessions; focus only re-renders so muscles whose
  // window has passed drop out.
  const [, setFocusedAt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void ensureLoaded();
      setFocusedAt(Date.now());
    }, [ensureLoaded])
  );

  const active = activeRecovery();
  const muscleIds = [...new Set(active.map((r) => r.muscleId))];
  const justTrainedIds = justTrainedMuscleIds(active);

  return (
    <Screen kind="tab">
      <View style={screenHeaderStyles.headerFixed}>
        <View style={styles.headerTop}>
          <View style={styles.headerTextBlock}>
            <Text style={[screenHeaderStyles.title, { color: colors.text }]} maxFontSizeMultiplier={fontScaleCap.title}>Recovery</Text>
            <Text style={[screenHeaderStyles.subtitle, { color: colors.textSecondary }]}>
              {active.length === 0
                ? 'All clear — every muscle group is ready'
                : 'Muscles still recovering from recent training'}
            </Text>
          </View>
          <Pressable
            onPress={() => setInfoVisible(true)}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.iconButtonPressed,
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="How recovery works"
          >
            <Ionicons name="help-circle-outline" size={22} color={colors.primary} />
          </Pressable>
        </View>
      </View>
      <RecoveryInfoModal
        visible={infoVisible}
        onClose={() => setInfoVisible(false)}
      />
      {isLoading ? (
        <View style={styles.placeholder}>
          <Skeleton width={220} height={220} borderRadius={110} />
          <Skeleton width="60%" height={14} style={{ marginTop: spacing.lg }} />
        </View>
      ) : active.length === 0 ? (
        <View style={styles.readyWrap}>
          <MuscleDiagram
            muscleIds={ALL_MUSCLE_IDS}
            variant={diagramVariant}
            highlightColor="green"
            size={0.9}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[screenHeaderStyles.scrollContent, { paddingBottom: 40 }]}>
          <View style={styles.diagramWrap}>
            <MuscleDiagram
              muscleIds={muscleIds}
              recoveringMuscleIds={muscleIds}
              justTrainedMuscleIds={justTrainedIds}
              variant={diagramVariant}
              size={0.85}
            />
            <View style={styles.legend}>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: colors.recoveryHot }]} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Just trained</Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: colors.recoveryWarm }]} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>In recovery</Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: colors.recoveryReady }]} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Ready</Text>
              </View>
            </View>
          </View>
          <Card>
            <Text style={[typography.sectionTitle, styles.listTitle, { color: colors.text }]}>In recovery</Text>
            {active.map((r, i) => (
              <View
                key={`${r.muscleId}-${r.trainedAt}-${i}`}
                style={[
                  styles.listRow,
                  i < active.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
              >
                <Text style={[typography.body, { color: colors.text }]}>
                  {muscleLabel(r.muscleId)}
                </Text>
                <Text style={[typography.caption, styles.recoveryUntil, { color: colors.textMuted }]}>
                  {formatRecoveryReady(getRecoveryUntil(r))}
                </Text>
              </View>
            ))}
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTextBlock: {
    flex: 1,
    marginRight: spacing.sm,
    minWidth: 0,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: { opacity: 0.8 },
  placeholder: { flex: 1, padding: spacing.lg, justifyContent: 'center', alignItems: 'center' },
  readyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  diagramWrap: { alignItems: 'center', marginBottom: spacing.xl },
  legend: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md, justifyContent: 'center', flexWrap: 'wrap' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  legendDot: { width: 10, height: 10, borderRadius: radius.sm / 2 },
  listTitle: { marginBottom: spacing.md },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
  },
  recoveryUntil: {
    fontFamily: typography.data.fontFamily,
  },
});
