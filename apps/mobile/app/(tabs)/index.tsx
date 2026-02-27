import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTheme } from '@/theme/ThemeContext';
import { useRouter } from 'expo-router';
import { useSessionsStore } from '@/store/sessionsStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { WorkoutHistoryChart } from '@/components/WorkoutHistoryChart';
import { formatRelative } from '@/utils/relativeTime';

export default function WorkoutsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { load: loadSessions, completedSessions } = useSessionsStore();
  const allTemplates = useTemplatesStore((s) => s.allTemplates);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  const completed = completedSessions();
  const templates = allTemplates();
  const getTemplateName = (templateId: string) =>
    templates.find((t) => t.id === templateId)?.name ?? 'Workout';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Workouts</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Choose a template or start a session
          </Text>
        </View>

        {completed.length > 0 && (
          <>
            <WorkoutHistoryChart sessions={completed} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent workouts</Text>
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

        <Pressable
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={() => router.push('/templates')}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>Templates</Text>
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
            Push/Pull/Legs, Upper/Lower, Strong Lifts, Arnold & custom
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={() => router.push('/active-workout')}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>Start workout</Text>
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
            Quick start or pick a planned workout
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
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
  card: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  cardDesc: { fontSize: 14, marginTop: 4 },
});
