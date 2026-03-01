import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { useTemplatesStore } from '@/store/templatesStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import type { WorkoutTemplate, WorkoutDay } from '@muscleos/types';

export default function WorkoutsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const loadTemplates = useTemplatesStore((s) => s.load);
  const allTemplates = useTemplatesStore((s) => s.allTemplates);
  const isLoading = useTemplatesStore((s) => s.isLoading);
  const subscriptionState = useSubscriptionStore((s) => s.state);
  const isPro = subscriptionState?.tier === 'pro' && (!subscriptionState?.expiresAt || new Date(subscriptionState.expiresAt) > new Date());
  const activeSession = useActiveWorkoutStore((s) => s.session);

  const [builtInExpanded, setBuiltInExpanded] = useState(true);
  const [customExpanded, setCustomExpanded] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const templates = allTemplates();
  const { builtIn, custom } = useMemo(() => {
    const builtIn: WorkoutTemplate[] = [];
    const custom: WorkoutTemplate[] = [];
    templates.forEach((t) => (t.isBuiltIn ? builtIn.push(t) : custom.push(t)));
    return { builtIn, custom };
  }, [templates]);

  function renderTemplateCard(template: WorkoutTemplate) {
    const hasDescription = Boolean(template.description?.trim());
    return (
      <View key={template.id} style={[styles.templateCard, { backgroundColor: colors.surfaceElevated }]}>
        <Text
          style={[
            styles.templateName,
            { color: colors.text },
            !hasDescription && styles.templateNameNoDesc,
          ]}
        >
          {template.name}
        </Text>
        {hasDescription ? (
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
                { backgroundColor: colors.background, opacity: pressed ? 0.9 : 1 },
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
    );
  }

  function handleStartDay(template: WorkoutTemplate, day: WorkoutDay) {
    if (activeSession) {
      Alert.alert(
        'Workout in progress',
        'Finish or cancel your current workout before starting another.',
        [
          { text: 'Resume workout', onPress: () => router.push('/active-workout') },
          { text: 'OK', style: 'cancel' },
        ]
      );
      return;
    }
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

  function handleStartEmptyWorkout() {
    if (activeSession) {
      Alert.alert(
        'Workout in progress',
        'Finish or cancel your current workout before starting another.',
        [
          { text: 'Resume workout', onPress: () => router.push('/active-workout') },
          { text: 'OK', style: 'cancel' },
        ]
      );
      return;
    }
    router.push({
      pathname: '/active-workout',
      params: {
        templateId: '_empty',
        dayId: '_empty',
        dayName: 'Workout',
        exerciseIds: '',
      },
    });
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Workouts</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Start empty or pick a template
          </Text>
          <Pressable
            style={[
              styles.startEmptyBtn,
              { backgroundColor: isPro ? colors.primary : colors.surfaceElevated },
            ]}
            onPress={() =>
              isPro ? handleStartEmptyWorkout() : router.push('/subscription')
            }
          >
            <Text
              style={[styles.startEmptyBtnText, { color: isPro ? '#fff' : colors.textSecondary }]}
            >
              {isPro ? 'Start empty workout' : 'Pro: Start empty workout'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.templatesSection}>
          <Text style={[styles.templatesSectionTitle, { color: colors.text }]}>Templates</Text>

          {isLoading ? (
            <View style={styles.placeholder}>
              <Text style={[styles.placeholderText, { color: colors.textMuted }]}>Loading…</Text>
            </View>
          ) : (
            <>
              {/* Custom section (first) */}
              <View style={[styles.collapsibleSection, { backgroundColor: colors.surface }]}>
                <Pressable
                  style={({ pressed }) => [
                    styles.sectionHeader,
                    styles.sectionHeaderLeft,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                  onPress={() => setCustomExpanded((e) => !e)}
                >
                  <Ionicons
                    name={customExpanded ? 'chevron-down' : 'chevron-forward'}
                    size={20}
                    color={colors.textSecondary}
                  />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Custom</Text>
                  <View style={[styles.sectionCount, { backgroundColor: colors.border }]}>
                    <Text style={[styles.sectionCountText, { color: colors.textSecondary }]}>
                      {custom.length}
                    </Text>
                  </View>
                </Pressable>
                {customExpanded && (
                  <View style={styles.sectionContent}>
                    {custom.length === 0 ? (
                      <Text style={[styles.emptySectionText, { color: colors.textMuted }]}>
                        No custom templates yet.
                      </Text>
                    ) : (
                      custom.map((template) => renderTemplateCard(template))
                    )}
                  </View>
                )}
              </View>

              {/* Built-in section */}
              <View style={[styles.collapsibleSection, { backgroundColor: colors.surface }]}>
                <Pressable
                  style={({ pressed }) => [
                    styles.sectionHeader,
                    styles.sectionHeaderLeft,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                  onPress={() => setBuiltInExpanded((e) => !e)}
                >
                  <Ionicons
                    name={builtInExpanded ? 'chevron-down' : 'chevron-forward'}
                    size={20}
                    color={colors.textSecondary}
                  />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Built-in</Text>
                  <View style={[styles.sectionCount, { backgroundColor: colors.border }]}>
                    <Text style={[styles.sectionCountText, { color: colors.textSecondary }]}>
                      {builtIn.length}
                    </Text>
                  </View>
                </Pressable>
                {builtInExpanded && (
                  <View style={styles.sectionContent}>
                    {builtIn.length === 0 ? (
                      <Text style={[styles.emptySectionText, { color: colors.textMuted }]}>
                        No built-in templates
                      </Text>
                    ) : (
                      builtIn.map((template) => renderTemplateCard(template))
                    )}
                  </View>
                )}
              </View>
            </>
          )}
        </View>
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
  startEmptyBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  startEmptyBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  templatesSection: { marginTop: 24 },
  templatesSectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  collapsibleSection: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  sectionHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: { fontSize: 17, fontWeight: '600', flex: 1 },
  sectionCount: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 28,
    alignItems: 'center',
  },
  sectionCountText: { fontSize: 13, fontWeight: '600' },
  sectionContent: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 0, gap: 10 },
  emptySectionText: { fontSize: 14, paddingVertical: 12, paddingHorizontal: 4 },
  placeholder: { paddingVertical: 24, alignItems: 'center' },
  placeholderText: { fontSize: 15 },
  templateCard: {
    padding: 14,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  templateName: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  templateNameNoDesc: { marginBottom: 10 },
  templateDesc: { fontSize: 14, marginBottom: 10 },
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
