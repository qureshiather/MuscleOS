import { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { screenHeaderStyles } from '@/theme/screenHeader';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useRecoveryStore } from '@/store/recoveryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { MUSCLE_GROUPS } from '@muscleos/types';
import type { MuscleId } from '@muscleos/types';
import { MuscleDiagram } from '@/components/MuscleDiagram';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatRecoveryReady } from '@/utils/relativeTime';
import { getRecoveryUntil } from '@/utils/recovery';

const ALL_MUSCLE_IDS: MuscleId[] = Object.keys(MUSCLE_GROUPS) as MuscleId[];

export default function RecoveryScreen() {
  const { colors } = useTheme();
  const load = useRecoveryStore((s) => s.load);
  const activeRecovery = useRecoveryStore((s) => s.activeRecovery);
  const isLoading = useRecoveryStore((s) => s.isLoading);
  const profile = useSettingsStore((s) => s.profile);
  const diagramVariant = profile?.sex === 'female' ? 'female' : 'male';

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const active = activeRecovery();
  const muscleIds = [...new Set(active.map((r) => r.muscleId))];
  const latestTrainedAt = active.length > 0
    ? active.reduce((max, r) => (r.trainedAt > max ? r.trainedAt : max), active[0].trainedAt)
    : null;
  const justTrainedMuscleIds = latestTrainedAt
    ? [...new Set(active.filter((r) => r.trainedAt === latestTrainedAt).map((r) => r.muscleId))]
    : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={screenHeaderStyles.headerFixed}>
        <Text style={[screenHeaderStyles.title, { color: colors.text }]}>Recovery</Text>
        <Text style={[screenHeaderStyles.subtitle, { color: colors.textSecondary }]}>
          {active.length === 0
            ? 'All clear — every muscle group is ready'
            : 'Muscles still recovering from recent training'}
        </Text>
      </View>
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
              justTrainedMuscleIds={justTrainedMuscleIds}
              variant={diagramVariant}
              showLabels
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
                  {MUSCLE_GROUPS[r.muscleId].name}
                </Text>
                <Text style={[typography.caption, styles.recoveryUntil, { color: colors.textMuted }]}>
                  {formatRecoveryReady(getRecoveryUntil(r))}
                </Text>
              </View>
            ))}
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
    paddingVertical: spacing.sm + 2,
  },
  recoveryUntil: {
    fontFamily: typography.data.fontFamily,
  },
});
