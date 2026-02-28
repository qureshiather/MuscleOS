import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTemplatesStore } from '@/store/templatesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { getExercise } from '@/data/exercises';
import { MUSCLE_GROUPS } from '@muscleos/types';
import type { MuscleId } from '@muscleos/types';
import { getExercisePrevious } from '@/storage/localStorage';
import { formatWeight } from '@/utils/weightUnits';
import { MuscleDiagram } from '@/components/MuscleDiagram';
export default function WorkoutPreviewScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    templateId?: string;
    dayId?: string;
    dayName?: string;
    exerciseIds?: string;
    defaultSets?: string;
  }>();
  const allTemplates = useTemplatesStore((s) => s.allTemplates);
  const weightUnit = useSettingsStore((s) => s.weightUnit);
  const [previousMap, setPreviousMap] = useState<Record<string, { weightKg: number; reps?: number }>>({});

  const templateId = params.templateId ?? '';
  const dayId = params.dayId ?? '';
  const dayName = params.dayName ?? '';
  const exerciseIds = (params.exerciseIds ?? '').split(',').filter(Boolean);
  const defaultSets = params.defaultSets != null ? parseInt(params.defaultSets, 10) : undefined;
  const defaultSetsValid = defaultSets != null && !Number.isNaN(defaultSets) && defaultSets > 0;

  const template = allTemplates().find((t) => t.id === templateId);
  const templateName = template?.name ?? 'Workout';

  const workoutMuscleIds: MuscleId[] = Array.from(
    new Set(
      exerciseIds.flatMap((id) => getExercise(id)?.muscles ?? [])
    )
  );
  const workoutMuscleNames = workoutMuscleIds.map((id) => MUSCLE_GROUPS[id].name).join(', ');

  useEffect(() => {
    getExercisePrevious().then(setPreviousMap);
  }, []);

  function handleStart() {
    router.replace({
      pathname: '/active-workout',
      params: {
        templateId,
        dayId,
        dayName,
        exerciseIds: exerciseIds.join(','),
        ...(defaultSetsValid && { defaultSets: params.defaultSets! }),
      },
    });
  }

  if (!templateId || !dayId || !dayName || exerciseIds.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
        </Pressable>
        <Text style={[styles.errorText, { color: colors.textMuted }]}>Missing workout details</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
        </Pressable>
        <View style={styles.headerTitleRow}>
          <View style={styles.titleBlock}>
            <Text style={[styles.dayName, { color: colors.text }]}>{dayName}</Text>
            <Text style={[styles.templateName, { color: colors.textSecondary }]}>{templateName}</Text>
          </View>
          <Pressable
            style={[styles.headerStartBtn, { backgroundColor: colors.primary }]}
            onPress={handleStart}
          >
            <Text style={styles.headerStartBtnText}>Start</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {workoutMuscleIds.length > 0 && (
          <View style={[styles.musclesSection, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Muscles used</Text>
            <MuscleDiagram muscleIds={workoutMuscleIds} size={0.85} />
            <Text style={[styles.muscleNames, { color: colors.textSecondary }]}>
              {workoutMuscleNames}
            </Text>
          </View>
        )}

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
          {exerciseIds.length} exercises · tap Start when ready
        </Text>
        {exerciseIds.map((exerciseId, index) => {
          const exercise = getExercise(exerciseId);
          const prev = previousMap[exerciseId];
          const muscleNames = exercise?.muscles.map((id) => MUSCLE_GROUPS[id].name).join(', ') ?? '—';
          return (
            <View
              key={exerciseId}
              style={[styles.exerciseCard, { backgroundColor: colors.surface }]}
            >
              <View style={styles.exerciseRow}>
                <Text style={[styles.exerciseIndex, { color: colors.textMuted }]}>{index + 1}</Text>
                <View style={styles.exerciseMain}>
                  <Text style={[styles.exerciseName, { color: colors.text }]}>
                    {exercise?.name ?? exerciseId}
                  </Text>
                  <Text style={[styles.muscles, { color: colors.textSecondary }]}>
                    {muscleNames}
                  </Text>
                  {prev && (
                    <Text style={[styles.previous, { color: colors.primary }]}>
                      Previous: {formatWeight(prev.weightKg, weightUnit)}
                      {prev.reps != null ? ` × ${prev.reps} reps` : ''}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backText: { fontSize: 16, marginBottom: 8 },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleBlock: { flex: 1, minWidth: 0 },
  headerStartBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  headerStartBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dayName: { fontSize: 24, fontWeight: '700' },
  templateName: { fontSize: 15, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionLabel: { fontSize: 13, marginBottom: 12 },
  musclesSection: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
    alignItems: 'center',
  },
  muscleNames: { fontSize: 13, marginTop: 8, textAlign: 'center' },
  exerciseCard: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  exerciseRow: { flexDirection: 'row', alignItems: 'flex-start' },
  exerciseIndex: { width: 24, fontSize: 14, marginRight: 12 },
  exerciseMain: { flex: 1 },
  exerciseName: { fontSize: 17, fontWeight: '600' },
  muscles: { fontSize: 13, marginTop: 4 },
  previous: { fontSize: 13, marginTop: 6, fontWeight: '500' },
  errorText: { padding: 20, fontSize: 15 },
});
