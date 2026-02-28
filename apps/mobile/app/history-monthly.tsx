import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { useSessionsStore } from '@/store/sessionsStore';
import type { WorkoutSession } from '@muscleos/types';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Set of YYYY-MM-DD for days that have at least one workout. */
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

/** Build calendar grid for a month: 0 = empty, 1-31 = day of month. */
function monthGrid(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const daysInMonth = last.getDate();
  const startWeekday = first.getDay(); // 0 = Sun

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
  const { colors } = useTheme();
  const router = useRouter();
  const { load: loadSessions, completedSessions } = useSessionsStore();
  const [viewDate, setViewDate] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  const completed = completedSessions();
  const workoutDays = useMemo(() => workoutDaysSet(completed), [completed]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const grid = useMemo(() => monthGrid(year, month), [year, month]);
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  function goPrevMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1));
  }
  function goNextMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1));
  }

  function dayKey(day: number | null): string {
    if (day == null) return '';
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          hitSlop={8}
        >
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Calendar</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.monthNav}>
          <Pressable
            onPress={goPrevMonth}
            style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
          <Pressable
            onPress={goNextMonth}
            style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}
            hitSlop={8}
          >
            <Ionicons name="chevron-forward" size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((label, i) => (
            <View key={i} style={styles.weekdayCell}>
              <Text style={[styles.weekdayLabel, { color: colors.textSecondary }]}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.calendarCard, { backgroundColor: colors.surface }]}>
          {grid.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.calendarRow}>
              {row.map((day, colIndex) => {
                const key = dayKey(day);
                const hasWorkout = day != null && workoutDays.has(key);
                return (
                  <View key={colIndex} style={styles.dayCell}>
                    {day != null ? (
                      <View
                        style={[
                          styles.dayInner,
                          hasWorkout && { backgroundColor: colors.primary },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            { color: hasWorkout ? '#fff' : colors.text },
                          ]}
                        >
                          {day}
                        </Text>
                        {hasWorkout && (
                          <View style={styles.checkmark}>
                            <Ionicons name="checkmark" size={10} color="#fff" />
                          </View>
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.legend}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]}>
            <Ionicons name="checkmark" size={10} color="#fff" />
          </View>
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>
            Day with completed workout
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const CELL_SIZE = 40;
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    paddingBottom: 16,
  },
  iconButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  iconButtonPressed: { opacity: 0.7 },
  title: { fontSize: 18, fontWeight: '600' },
  scroll: { padding: 20, paddingBottom: 40 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  navButton: { padding: 8 },
  navButtonPressed: { opacity: 0.7 },
  monthLabel: { fontSize: 18, fontWeight: '600' },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayCell: {
    width: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayLabel: { fontSize: 12, fontWeight: '600' },
  calendarCard: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  calendarRow: { flexDirection: 'row' },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 2,
  },
  dayInner: {
    width: CELL_SIZE - 4,
    height: CELL_SIZE - 4,
    borderRadius: (CELL_SIZE - 4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 15, fontWeight: '500' },
  checkmark: { position: 'absolute', bottom: 1 },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  legendDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendText: { fontSize: 13 },
});
