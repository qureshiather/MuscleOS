import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTemplatesStore } from '@/store/templatesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { MUSCLE_GROUPS } from '@muscleos/types';
import type { MuscleId } from '@muscleos/types';
import { getExercisePrevious } from '@/storage/localStorage';
import { formatWeight } from '@/utils/weightUnits';
import { MuscleDiagram } from '@/components/MuscleDiagram';
import { Card } from '@/components/ui/Card';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

export default function WorkoutPreviewScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const activeSession = useActiveWorkoutStore((s) => s.session);
  const params = useLocalSearchParams<{
    templateId?: string;
    exerciseIds?: string;
    defaultSets?: string;
  }>();
  const allTemplates = useTemplatesStore((s) => s.allTemplates);
  const weightUnit = useSettingsStore((s) => s.weightUnit);
  const [previousMap, setPreviousMap] = useState<Record<string, { weightKg: number; reps?: number }>>({});

  const templateId = params.templateId ?? '';
  const exerciseIds = (params.exerciseIds ?? '').split(',').filter(Boolean);
  const defaultSets = params.defaultSets != null ? parseInt(params.defaultSets, 10) : undefined;
  const defaultSetsValid = defaultSets != null && !Number.isNaN(defaultSets) && defaultSets > 0;

  const template = allTemplates().find((t) => t.id === templateId);
  const templateName = template?.name ?? 'Workout';

  const getExercise = useExercisesStore((s) => s.getExercise);
  const workoutMuscleIds: MuscleId[] = Array.from(
    new Set(exerciseIds.flatMap((id) => getExercise(id)?.muscles ?? []))
  );
  const workoutMuscleNames = workoutMuscleIds.map((id) => MUSCLE_GROUPS[id].name).join(', ');

  useEffect(() => {
    getExercisePrevious().then(setPreviousMap);
  }, []);

  useEffect(() => {
    if (activeSession) {
      router.replace('/active-workout');
    }
  }, [activeSession, router]);

  function handleStart() {
    if (activeSession) return;
    router.replace({
      pathname: '/active-workout',
      params: {
        templateId,
        exerciseIds: exerciseIds.join(','),
        ...(defaultSetsValid && { defaultSets: params.defaultSets! }),
      },
    });
  }

  if (!templateId || exerciseIds.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.accent} />
          <Text style={[typography.label, { color: colors.accent }]}>Back</Text>
        </Pressable>
        <Text style={[typography.body, { color: colors.textMuted, padding: spacing.lg }]}>
          Missing workout details
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.accent} />
          <Text style={[typography.label, { color: colors.accent }]}>Back</Text>
        </Pressable>
        <View style={styles.headerTitleRow}>
          <Text style={[typography.screenTitle, styles.templateTitle, { color: colors.text }]} numberOfLines={2}>
            {templateName}
          </Text>
          <Pressable
            style={[styles.headerStartBtn, { backgroundColor: colors.primary }]}
            onPress={handleStart}
          >
            <Text style={[typography.button, { color: '#fff' }]}>Start</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {workoutMuscleIds.length > 0 && (
          <Card style={styles.musclesSection}>
            <Text style={[typography.caption, styles.sectionLabel, { color: colors.textMuted }]}>
              Muscles used
            </Text>
            <MuscleDiagram muscleIds={workoutMuscleIds} size={0.85} />
            <Text style={[typography.caption, styles.muscleNames, { color: colors.textSecondary }]}>
              {workoutMuscleNames}
            </Text>
          </Card>
        )}

        <Text style={[typography.caption, styles.sectionLabel, { color: colors.textMuted }]}>
          {exerciseIds.length} exercises · review, then start
        </Text>
        {exerciseIds.map((exerciseId, index) => {
          const exercise = getExercise(exerciseId);
          const prev = previousMap[exerciseId];
          const muscleNames =
            exercise?.muscles.map((id) => MUSCLE_GROUPS[id].name).join(', ') ?? '—';
          return (
            <Card key={exerciseId} elevated style={styles.exerciseCard}>
              <View style={styles.exerciseRow}>
                <Text style={[typography.data, styles.exerciseIndex, { color: colors.textMuted }]}>
                  {String(index + 1).padStart(2, '0')}
                </Text>
                <View style={styles.exerciseMain}>
                  <Text style={[typography.bodyMedium, { color: colors.text }]}>
                    {exercise?.name ?? exerciseId}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                    {muscleNames}
                  </Text>
                  {prev ? (
                    <Text style={[typography.caption, styles.previous, { color: colors.primary }]}>
                      Previous: {formatWeight(prev.weightKg, weightUnit)}
                      {prev.reps != null ? ` × ${prev.reps}` : ''}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Card>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <PrimaryButton label="Start workout" onPress={handleStart} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg + 4,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: spacing.sm },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerStartBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  templateTitle: { flex: 1, fontSize: 24, minWidth: 0 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg + 4, paddingBottom: spacing.xxl },
  sectionLabel: {
    fontFamily: typography.label.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.md,
  },
  musclesSection: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  muscleNames: { marginTop: spacing.sm, textAlign: 'center' },
  exerciseCard: {
    marginBottom: spacing.sm + 2,
    padding: spacing.md + 2,
  },
  exerciseRow: { flexDirection: 'row', alignItems: 'flex-start' },
  exerciseIndex: { width: 28, marginRight: spacing.md, marginTop: 2 },
  exerciseMain: { flex: 1 },
  previous: { marginTop: spacing.sm - 2, fontFamily: typography.data.fontFamily },
  footer: {
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
