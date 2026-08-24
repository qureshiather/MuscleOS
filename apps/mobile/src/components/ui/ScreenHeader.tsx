import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/tokens';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** 'back' chevron, 'close' X, or none */
  backIcon?: 'back' | 'close' | 'none';
  right?: React.ReactNode;
};

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  backIcon = 'back',
  right,
}: ScreenHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.wrap, { borderBottomColor: colors.border }]}>
      {backIcon !== 'none' && onBack ? (
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [styles.sideBtn, { opacity: pressed ? 0.7 : 1 }]}
          hitSlop={8}
        >
          <Ionicons
            name={backIcon === 'close' ? 'close' : 'chevron-back'}
            size={backIcon === 'close' ? 26 : 28}
            color={colors.primary}
          />
        </Pressable>
      ) : (
        <View style={styles.sideBtn} />
      )}
      <View style={styles.center}>
        <Text style={[typography.sectionTitle, { color: colors.text, textAlign: 'center' }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 2 }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.sideBtn}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sideBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, minWidth: 0, paddingHorizontal: spacing.xs },
});
