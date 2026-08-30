import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing, touch } from '@/theme/tokens';
import { fontScaleCap } from '@/theme/layout';

type Option<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  options: readonly Option<T>[] | Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            style={[
              styles.btn,
              selected
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
            onPress={() => onChange(opt.value)}
          >
            <Text
              style={[typography.label, { color: selected ? colors.primaryOn : colors.text, textAlign: 'center' }]}
              maxFontSizeMultiplier={fontScaleCap.chrome}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    minWidth: 72,
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    flexGrow: 1,
    flexBasis: 0,
  },
});
