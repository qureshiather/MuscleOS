import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing } from '@/theme/tokens';

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = radius.sm,
  style,
}: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: colors.surfaceElevated, opacity },
        style,
      ]}
    />
  );
}

type SkeletonCardProps = {
  lines?: number;
};

export function SkeletonCard({ lines = 3 }: SkeletonCardProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Skeleton width="40%" height={12} />
      <Skeleton width="70%" height={18} style={{ marginTop: spacing.sm }} />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <Skeleton
          key={i}
          width={i % 2 === 0 ? '90%' : '55%'}
          height={12}
          style={{ marginTop: spacing.sm }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
});
