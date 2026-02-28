import { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { useSessionsStore } from '@/store/sessionsStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { formatRelative } from '@/utils/relativeTime';

export default function HistoryScreen() {
  const { colors } = useTheme();
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
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>History</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Previous workouts you’ve completed
        </Text>
      </View>
      {completed.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            No workouts yet. Complete a workout to see it here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.listCard, { backgroundColor: colors.surface }]}>
            {completed.map((s, i, arr) => (
              <View
                key={s.id}
                style={[
                  styles.row,
                  {
                    borderBottomColor: colors.border,
                    borderBottomWidth: i < arr.length - 1 ? StyleSheet.hairlineWidth : 0,
                  },
                ]}
              >
                <Text style={[styles.rowTitle, { color: colors.text }]}>
                  {s.dayName} · {getTemplateName(s.templateId)}
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {s.completedAt ? formatRelative(s.completedAt) : ''}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, marginTop: 4 },
  empty: { flex: 1, justifyContent: 'center', padding: 20 },
  emptyText: { fontSize: 16, textAlign: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  listCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowTitle: { fontSize: 16, fontWeight: '500' },
  rowSubtitle: { fontSize: 14 },
});
