import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { WorkoutSession } from '@muscleos/types';
import { useTheme } from '@/theme/ThemeContext';

const DAYS = 14;
const CHART_HEIGHT = 120;
const BAR_GAP = 4;

/** Bucket sessions by calendar day (local time) for the last N days. */
function workoutsPerDay(sessions: WorkoutSession[], days: number): number[] {
  const completed = sessions.filter((s) => s.completedAt);
  const counts = new Array(days).fill(0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (const s of completed) {
    const d = new Date(s.completedAt!);
    d.setHours(0, 0, 0, 0);
    const diff = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
    if (diff >= 0 && diff < days) {
      counts[days - 1 - diff] += 1;
    }
  }
  return counts;
}

/** Labels for the last N days (e.g. "Mon", "12/1"). */
function dayLabels(days: number): string[] {
  const labels: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
  }
  return labels;
}

interface WorkoutHistoryChartProps {
  sessions: WorkoutSession[];
  /** Number of days to show (default 14) */
  days?: number;
}

export function WorkoutHistoryChart({ sessions, days = DAYS }: WorkoutHistoryChartProps) {
  const { colors } = useTheme();
  const counts = useMemo(() => workoutsPerDay(sessions, days), [sessions, days]);
  const labels = useMemo(() => dayLabels(days), [days]);
  const maxCount = Math.max(1, ...counts);
  const barWidth = 20;
  const totalWidth = days * barWidth + (days - 1) * BAR_GAP;

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.title, { color: colors.text }]}>Workouts over time</Text>
      <View style={styles.chartRow}>
        <Svg width={totalWidth} height={CHART_HEIGHT} style={styles.svg}>
          {counts.map((c, i) => {
            const x = i * (barWidth + BAR_GAP);
            const h = maxCount > 0 ? (c / maxCount) * (CHART_HEIGHT - 8) : 0;
            const y = CHART_HEIGHT - h;
            return (
              <Rect
                key={i}
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx={4}
                fill={colors.primary ?? '#6366f1'}
                opacity={c > 0 ? 1 : 0.25}
              />
            );
          })}
        </Svg>
      </View>
      <View style={[styles.labelsRow, { width: totalWidth }]}>
        {labels.map((label, i) => (
          <View key={i} style={[styles.labelSlot, { width: barWidth + BAR_GAP }]}>
            <Text
              style={[styles.label, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 24 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  chartRow: { flexDirection: 'row', height: CHART_HEIGHT },
  svg: {},
  labelsRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  labelSlot: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10, textAlign: 'center' },
});
