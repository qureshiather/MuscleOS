import { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { useSessionsStore } from '@/store/sessionsStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { WorkoutHistoryChart } from '@/components/WorkoutHistoryChart';
import { formatRelative } from '@/utils/relativeTime';
import type { WorkoutTemplate, WorkoutDay } from '@muscleos/types';

export default function WorkoutsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { load: loadSessions, completedSessions } = useSessionsStore();
  const loadTemplates = useTemplatesStore((s) => s.load);
  const allTemplates = useTemplatesStore((s) => s.allTemplates);
  const isLoading = useTemplatesStore((s) => s.isLoading);
  const isPro = useSubscriptionStore((s) => s.isPro)();

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  const completed = completedSessions();
  const templates = allTemplates();
  const getTemplateName = (templateId: string) =>
    templates.find((t) => t.id === templateId)?.name ?? 'Workout';

  function handleStartDay(template: WorkoutTemplate, day: WorkoutDay) {
    router.push({
      pathname: '/workout-preview',
      params: {
        templateId: template.id,
        dayId: day.id,
        dayName: day.name,
        exerciseIds: day.exerciseIds.join(','),
      },
    });
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Workouts</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Choose a template to start
          </Text>
          <Pressable
            style={[
              styles.createBtn,
              { backgroundColor: isPro ? colors.primary : colors.surfaceElevated },
            ]}
            onPress={() =>
              isPro ? router.push('/create-template') : router.push('/subscription')
            }
          >
            <Text
              style={[styles.createBtnText, { color: isPro ? '#fff' : colors.textSecondary }]}
            >
              {isPro ? 'Create new template' : 'Pro: Create new template'}
            </Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.placeholder}>
            <Text style={[styles.placeholderText, { color: colors.textMuted }]}>Loading…</Text>
          </View>
        ) : (
          <>
            {templates.map((template) => (
              <View
                key={template.id}
                style={[styles.templateCard, { backgroundColor: colors.surface }]}
              >
                <View style={styles.templateHeader}>
                  <Text style={[styles.templateName, { color: colors.text }]}>{template.name}</Text>
                  {template.isBuiltIn && (
                    <View style={[styles.badge, { backgroundColor: colors.border }]}>
                      <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                        Built-in
                      </Text>
                    </View>
                  )}
                </View>
                {template.description ? (
                  <Text style={[styles.templateDesc, { color: colors.textSecondary }]}>
                    {template.description}
                  </Text>
                ) : null}
                <View style={styles.daysRow}>
                  {template.days.map((day) => (
                    <Pressable
                      key={day.id}
                      style={({ pressed }) => [
                        styles.dayChip,
                        {
                          backgroundColor: colors.surfaceElevated,
                          opacity: pressed ? 0.9 : 1,
                        },
                      ]}
                      onPress={() => handleStartDay(template, day)}
                    >
                      <Text style={[styles.dayChipText, { color: colors.primary }]}>{day.name}</Text>
                      <Text style={[styles.dayChipMeta, { color: colors.textMuted }]}>
                        {day.exerciseIds.length} exercises
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </>
        )}

        {completed.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent workouts</Text>
            <WorkoutHistoryChart sessions={completed} />
            <View style={[styles.historyCard, { backgroundColor: colors.surface }]}>
              {completed.slice(0, 15).map((s, i, arr) => (
                <View
                  key={s.id}
                  style={[
                    styles.historyRow,
                    {
                      borderBottomColor: colors.border,
                      borderBottomWidth: i < arr.length - 1 ? StyleSheet.hairlineWidth : 0,
                    },
                  ]}
                >
                  <Text style={[styles.historyDay, { color: colors.text }]}>
                    {s.dayName} · {getTemplateName(s.templateId)}
                  </Text>
                  <Text style={[styles.historyAgo, { color: colors.textSecondary }]}>
                    {s.completedAt ? formatRelative(s.completedAt) : ''}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, marginTop: 4 },
  createBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  createBtnText: { fontSize: 15, fontWeight: '600' },
  placeholder: { paddingVertical: 24, alignItems: 'center' },
  placeholderText: { fontSize: 15 },
  templateCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  templateHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  templateName: { fontSize: 18, fontWeight: '600' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 12 },
  templateDesc: { fontSize: 14, marginBottom: 12 },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    minWidth: 100,
  },
  dayChipText: { fontSize: 15, fontWeight: '600' },
  dayChipMeta: { fontSize: 12, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: 8, marginBottom: 12 },
  historyCard: {
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  historyDay: { fontSize: 16, fontWeight: '500' },
  historyAgo: { fontSize: 14 },
});
