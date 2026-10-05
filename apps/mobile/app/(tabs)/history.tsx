import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  LayoutAnimation,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { Screen } from '@/components/layout';
import { screenHeaderStyles } from '@/theme/screenHeader';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useSessionsStore } from '@/store/sessionsStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { SessionCard } from '@/components/history/SessionCard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { WorkoutSession } from '@muscleos/types';
import { syncNow } from '@/sync';
import { useAuthStore } from '@/store/authStore';
import { fontScaleCap } from '@/theme/layout';
import {
  buildSessionPRs,
  buildVolumeDeltas,
  groupSessionsByWeek,
  isCardExpanded,
  templateDisplayName,
  weekSummary,
} from '@/utils/historyCards';
import { useSettingsStore } from '@/store/settingsStore';

export default function HistoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { load: loadSessions, sessions, completedSessions, deleteSession } = useSessionsStore();
  const allTemplates = useTemplatesStore((s) => s.allTemplates);
  const getExercise = useExercisesStore((s) => s.getExercise);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const weightUnit = useSettingsStore((s) => s.weightUnit);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    if (isAnonymous) {
      await loadSessions();
      return;
    }
    setRefreshing(true);
    try {
      await syncNow();
      await loadSessions();
    } finally {
      setRefreshing(false);
    }
  }, [isAnonymous, loadSessions]);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: completedSessions() reads `sessions` from the store.
  const completed = useMemo(() => completedSessions(), [sessions, completedSessions]);
  const templates = allTemplates();

  const weeks = useMemo(() => groupSessionsByWeek(completed), [completed]);
  // Alias-logged lifts compete with their canonical catalog exercise.
  const sessionPRs = useMemo(
    () => buildSessionPRs(completed, (id) => getExercise(id)?.id ?? id),
    [completed, getExercise]
  );
  const volumeDeltas = useMemo(() => buildVolumeDeltas(completed), [completed]);

  // The newest session starts open; every other card starts collapsed. `toggled` flips either.
  const newestId = completed[0]?.id;
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  const isExpanded = (id: string) => isCardExpanded(id, newestId, toggled);
  const toggle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [deleteTarget, setDeleteTarget] = useState<WorkoutSession | null>(null);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    await deleteSession(id);
  }

  return (
    <Screen kind="tab">
      <View style={screenHeaderStyles.headerFixed}>
        <View style={styles.headerTop}>
          <View style={styles.headerTextBlock}>
            <Text style={[screenHeaderStyles.title, { color: colors.text }]} maxFontSizeMultiplier={fontScaleCap.title}>History</Text>
            <Text style={[screenHeaderStyles.subtitle, { color: colors.textSecondary }]}>
              Past sessions & volume
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <Pressable
              onPress={() => router.push('/personal-records')}
              style={({ pressed }) => [
                styles.iconButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.iconButtonPressed,
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Personal records"
            >
              <Ionicons name="trophy-outline" size={22} color={colors.primary} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/history-monthly')}
              style={({ pressed }) => [
                styles.iconButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.iconButtonPressed,
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Monthly calendar"
            >
              <Ionicons name="calendar-outline" size={22} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[
          screenHeaderStyles.scrollContent,
          { paddingBottom: 40 },
          completed.length === 0 && styles.emptyContent,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        testID="history-scroll"
      >
        {completed.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
              <Ionicons name="time-outline" size={28} color={colors.textMuted} />
            </View>
            <Text style={[typography.sectionTitle, { color: colors.text, marginTop: spacing.md }]}>
              No sessions yet
            </Text>
            <Text style={[typography.body, styles.emptyText, { color: colors.textMuted }]}>
              Finish a workout and it will show up here with duration, volume, and sets.
            </Text>
          </View>
        ) : (
          weeks.map((week) => (
            <View key={week.weekStart} style={styles.week}>
              <View style={styles.weekHeader}>
                <Text style={[styles.weekLabel, { color: colors.textMuted }]}>{week.label}</Text>
                <Text style={[styles.weekStats, { color: colors.textMuted }]}>
                  {weekSummary(week, weightUnit)}
                </Text>
              </View>
              <View style={styles.cardsContainer}>
                {week.sessions.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    title={templateDisplayName(templates, s.templateId)}
                    expanded={isExpanded(s.id)}
                    onToggle={() => toggle(s.id)}
                    onDelete={() => setDeleteTarget(s)}
                    prExerciseIds={sessionPRs.get(s.id)}
                    volumeDelta={volumeDeltas.get(s.id)}
                    getExerciseName={(id) => getExercise(id)?.name ?? id}
                    weightUnit={weightUnit}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <ConfirmDialog
        visible={deleteTarget != null}
        title="Delete workout"
        message="Removes this session from history and its recovery impact. This cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        cancelTestID="delete-session-keep"
        confirmTestID="delete-session-confirm"
      />
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
  headerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
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
  emptyContent: { flexGrow: 1 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { textAlign: 'center', marginTop: spacing.sm },
  week: { marginBottom: spacing.lg },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  weekLabel: { ...typography.caption, fontFamily: typography.label.fontFamily, textTransform: 'uppercase', letterSpacing: 0.7 },
  weekStats: { ...typography.caption, fontFamily: typography.data.fontFamily },
  cardsContainer: { gap: spacing.md },
});
