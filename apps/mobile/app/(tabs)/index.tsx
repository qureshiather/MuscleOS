import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { useTemplatesStore } from '@/store/templatesStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import type { WorkoutTemplate, WorkoutDay } from '@muscleos/types';

export default function WorkoutsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const loadTemplates = useTemplatesStore((s) => s.load);
  const allTemplates = useTemplatesStore((s) => s.allTemplates);
  const isLoading = useTemplatesStore((s) => s.isLoading);
  const isPro = useSubscriptionStore((s) => s.isPro)();

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const templates = allTemplates();

  function handleStartDay(template: WorkoutTemplate, day: WorkoutDay) {
    router.push({
      pathname: '/workout-preview',
      params: {
        templateId: template.id,
        dayId: day.id,
        dayName: day.name,
        exerciseIds: day.exerciseIds.join(','),
        ...(day.defaultSets != null && { defaultSets: String(day.defaultSets) }),
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
});
