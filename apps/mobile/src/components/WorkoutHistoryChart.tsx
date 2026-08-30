import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { WorkoutSession } from '@muscleos/types';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { fontScaleCap } from '@/theme/layout';
import { spacing } from '@/theme/tokens';

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
  days?: number;
}

export function WorkoutHistoryChart({ sessions, days = DAYS }: WorkoutHistoryChartProps) {
  const { colors } = useTheme();
  const [chartWidth, setChartWidth] = useState(0);
  const counts = useMemo(() => workoutsPerDay(sessions, days), [sessions, days]);
  const labels = useMemo(() => dayLabels(days), [days]);
  const maxCount = Math.max(1, ...counts);

  const barWidth =
    chartWidth > 0 ? Math.max(4, (chartWidth - (days - 1) * BAR_GAP) / days) : 0;

  function onLayout(e: LayoutChangeEvent) {
    const next = Math.floor(e.nativeEvent.layout.width);
    setChartWidth((prev) => (prev === next ? prev : next));
  }

  return (
    <View style={styles.wrapper} onLayout={onLayout}>
      <Text style={[typography.sectionTitle, styles.title, { color: colors.text }]}>
        Workouts over time
      </Text>
      {barWidth > 0 ? (
        <>
          <View style={styles.chartRow}>
            <Svg width={chartWidth} height={CHART_HEIGHT}>
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
                    fill={colors.primary}
                    opacity={c > 0 ? 1 : 0.25}
                  />
                );
              })}
            </Svg>
          </View>
          <View style={styles.labelsRow}>
            {labels.map((label, i) => (
              <View key={i} style={[styles.labelSlot, { width: barWidth + BAR_GAP }]}>
                <Text
                  style={[typography.caption, styles.label, { color: colors.textSecondary }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={fontScaleCap.fixed}
                >
                  {label.slice(0, 1)}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.xl, width: '100%' },
  title: { marginBottom: spacing.md },
  chartRow: { height: CHART_HEIGHT },
  labelsRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  labelSlot: { alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center' },
});
