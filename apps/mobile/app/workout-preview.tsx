import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTemplatesStore } from '@/store/templatesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { getExercise } from '@/data/exercises';
import { MUSCLE_GROUPS } from '@muscleos/types';
import { getExercisePrevious } from '@/storage/localStorage';
import { formatWeight } from '@/utils/weightUnits';
export default function WorkoutPreviewScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    templateId?: string;
    dayId?: string;
    dayName?: string;
    exerciseIds?: string;
  }>();
  const allTemplates = useTemplatesStore((s) => s.allTemplates);
  const weightUnit = useSettingsStore((s) => s.weightUnit);
  const [previousMap, setPreviousMap] = useState<Record<string, { weightKg: number; reps?: number }>>({});

  const templateId = params.templateId ?? '';
  const dayId = params.dayId ?? '';
  const dayName = params.dayName ?? '';
  const exerciseIds = (params.exerciseIds ?? '').split(',').filter(Boolean);

  const template = allTemplates().find((t) => t.id === templateId);
  const templateName = template?.name ?? 'Workout';
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
        <View style={styles.titleBlock}>
          <Text style={[styles.dayName, { color: colors.text }]}>{dayName}</Text>
          <Text style={[styles.templateName, { color: colors.textSecondary }]}>{templateName}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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

        <Pressable
          style={[styles.startBtn, { backgroundColor: colors.primary }]}
          onPress={handleStart}
        >
          <Text style={styles.startBtnText}>Start workout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  backText: { fontSize: 16, marginBottom: 8 },
  titleBlock: {},
  dayName: { fontSize: 24, fontWeight: '700' },
  templateName: { fontSize: 15, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionLabel: { fontSize: 13, marginBottom: 12 },
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
  startBtn: {
    padding: 18,
    borderRadius: 14,
    marginTop: 24,
  },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '600', textAlign: 'center' },
  errorText: { padding: 20, fontSize: 15 },
});
