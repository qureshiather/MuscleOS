import { ScrollView, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { useScreenGutter, useScrollBottomPadding } from '@/theme/layout';
import { spacing } from '@/theme/tokens';

type ScreenScrollProps = ScrollViewProps & {
  /** `tab` = visual padding only. `stack` = also reserve the home indicator. */
  kind?: 'tab' | 'stack';
  /** Skip the default horizontal gutter (e.g. a list that pads its own rows). */
  flush?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/** Scroll body with device-aware gutters and bottom inset. */
export function ScreenScroll({
  kind = 'stack',
  flush = false,
  contentContainerStyle,
  keyboardShouldPersistTaps = 'handled',
  showsVerticalScrollIndicator = false,
  children,
  ...rest
}: ScreenScrollProps) {
  const gutter = useScreenGutter();
  const paddingBottom = useScrollBottomPadding(kind);

  return (
    <ScrollView
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      contentContainerStyle={[
        {
          paddingHorizontal: flush ? 0 : gutter,
          paddingTop: spacing.lg,
          paddingBottom,
        },
        contentContainerStyle,
      ]}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}
