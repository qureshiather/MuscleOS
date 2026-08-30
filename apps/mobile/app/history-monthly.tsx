import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { Screen } from '@/components/layout';
import { fontScaleCap, useClampedFontScale, useContentWidth, useScreenGutter } from '@/theme/layout';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useSessionsStore } from '@/store/sessionsStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import type { WorkoutSession } from '@muscleos/types';
import { useRequirePro } from '@/hooks/useProGate';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function workoutDaysSet(sessions: WorkoutSession[]): Set<string> {
  const set = new Set<string>();
  for (const s of sessions) {
    if (!s.completedAt) continue;
    const d = new Date(s.completedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    set.add(key);
  }
  return set;
}

function formatDayLabel(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00');
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getSessionDuration(session: WorkoutSession): string | null {
  if (!session.startedAt || !session.completedAt) return null;
  const ms = new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime();
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function monthGrid(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const daysInMonth = last.getDate();
  const startWeekday = first.getDay();

  const flat: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) flat.push(null);
  for (let d = 1; d <= daysInMonth; d++) flat.push(d);
  while (flat.length % 7 !== 0) flat.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < flat.length; i += 7) {
    rows.push(flat.slice(i, i + 7));
  }
  return rows;
}

export default function HistoryMonthlyScreen() {
  const isPro = useRequirePro('monthly_calendar');
  const { colors } = useTheme();
  const router = useRouter();
  const gutter = useScreenGutter();
  const fontScale = useClampedFontScale(fontScaleCap.fixed);
  const contentWidth = useContentWidth(gutter * 2);
  const { load: loadSessions, completedSessions } = useSessionsStore();
  const allTemplates = useTemplatesStore((s) => s.allTemplates);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  const completed = completedSessions();
  const templates = allTemplates();
  const workoutDays = useMemo(() => workoutDaysSet(completed), [completed]);
  const getTemplateName = (templateId: string) =>
    templates.find((t) => t.id === templateId)?.name ?? 'Workout';

  const sessionsForSelectedDay = useMemo(() => {
    if (!selectedDayKey) return [];
    return completed.filter((s) => {
      if (!s.completedAt) return false;
      const d = new Date(s.completedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return key === selectedDayKey;
    });
  }, [completed, selectedDayKey]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const grid = useMemo(() => monthGrid(year, month), [year, month]);
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const cardPad = spacing.md;
  const cellWidth = Math.floor((contentWidth - cardPad * 2) / 7);
  const cellHeight = Math.max(cellWidth, Math.round(36 * fontScale));

  function goPrevMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1));
    setSelectedDayKey(null);
  }
  function goNextMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1));
    setSelectedDayKey(null);
  }

  function dayKey(day: number | null): string {
    if (day == null) return '';
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  if (!isPro) return null;

  return (
    <Screen>
      <ScreenHeader title="Calendar" onBack={() => router.back()} backIcon="close" />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.monthNav}>
          <Pressable
            onPress={goPrevMonth}
            style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.7 }]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[typography.sectionTitle, { color: colors.text }]}>{monthLabel}</Text>
          <Pressable
            onPress={goNextMonth}
            style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.7 }]}
            hitSlop={8}
          >
            <Ionicons name="chevron-forward" size={24} color={colors.text} />
          </Pressable>
        </View>

        <Card style={{ padding: cardPad }}>
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label, i) => (
              <View key={i} style={[styles.weekdayCell, { width: cellWidth }]}>
                <Text
                  style={[typography.caption, styles.weekdayLabel, { color: colors.textMuted }]}
                  maxFontSizeMultiplier={fontScaleCap.fixed}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>

          {grid.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.calendarRow}>
              {row.map((day, colIndex) => {
                const key = dayKey(day);
                const hasWorkout = day != null && workoutDays.has(key);
                const isSelected = key === selectedDayKey;
                return (
                  <View key={colIndex} style={[styles.dayCell, { width: cellWidth, height: cellHeight }]}>
                    {day != null ? (
                      <Pressable
                        onPress={() => setSelectedDayKey(isSelected ? null : key)}
                        style={({ pressed }) => [
                          styles.dayInner,
                          {
                            width: cellWidth - 6,
                            height: cellHeight - 6,
                            borderRadius: Math.min(cellWidth, cellHeight) / 2,
                          },
                          hasWorkout && { backgroundColor: colors.primary },
                          isSelected && {
                            borderWidth: 2,
                            borderColor: hasWorkout ? '#fff' : colors.primary,
                          },
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <Text
                          style={[
                            typography.data,
                            styles.dayText,
                            { color: hasWorkout ? '#fff' : colors.text },
                          ]}
                          maxFontSizeMultiplier={fontScaleCap.fixed}
                        >
                          {day}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </Card>

        {selectedDayKey != null && (
          <Card style={styles.dayDetailCard}>
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.md }]}>
              {formatDayLabel(selectedDayKey)}
            </Text>
            {sessionsForSelectedDay.length === 0 ? (
              <Text style={[typography.body, { color: colors.textMuted }]}>No workouts this day</Text>
            ) : (
              sessionsForSelectedDay.map((s, idx) => (
                <View
                  key={s.id}
                  style={[
                    styles.dayDetailRow,
                    idx < sessionsForSelectedDay.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[typography.bodyMedium, { color: colors.text, flex: 1 }]}>
                    {getTemplateName(s.templateId)}
                  </Text>
                  {getSessionDuration(s) ? (
                    <Text style={[typography.data, { color: colors.textSecondary }]}>
                      {getSessionDuration(s)}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: spacing.lg + 4, paddingBottom: 40 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  navButton: { padding: spacing.sm },
  weekdayRow: { flexDirection: 'row', marginBottom: spacing.sm },
  weekdayCell: { alignItems: 'center', justifyContent: 'center' },
  weekdayLabel: { fontFamily: typography.label.fontFamily },
  calendarRow: { flexDirection: 'row' },
  dayCell: { alignItems: 'center', justifyContent: 'center' },
  dayInner: { alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14 },
  dayDetailCard: { marginTop: spacing.md },
  dayDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
  },
});
