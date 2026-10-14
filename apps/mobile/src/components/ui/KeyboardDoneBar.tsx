import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/tokens';

/**
 * A "Done" bar above the iOS keyboard, for fields whose keyboard has no return key (`number-pad`,
 * `decimal-pad`). Point a field at it with `inputAccessoryViewID={nativeID}`. Android's numeric
 * keyboard has its own check key, so this renders nothing there.
 */
export function KeyboardDoneBar({ nativeID }: { nativeID: string }) {
  const { colors } = useTheme();
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={nativeID}>
      <View style={[styles.bar, { backgroundColor: colors.surfaceElevated, borderTopColor: colors.border }]}>
        <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8} accessibilityRole="button">
          <Text style={[typography.button, { color: colors.primary }]}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
