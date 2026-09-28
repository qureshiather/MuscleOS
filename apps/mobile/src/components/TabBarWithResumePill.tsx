import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { ResumeWorkoutPill } from '@/components/ResumeWorkoutPill';
import { useTheme } from '@/theme/ThemeContext';
import {
  TAB_ICON_LABEL_GAP,
  TAB_ICON_SIZE,
  useTabBarLayout,
} from '@/theme/layout';
import { typography } from '@/theme/typography';

type Props = BottomTabBarProps & { showPill: boolean };

export function TabBarWithResumePill({ state, descriptors, navigation, showPill }: Props) {
  const { colors } = useTheme();
  const tabBar = useTabBarLayout();

  return (
    <View>
      {showPill ? <ResumeWorkoutPill /> : null}
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: tabBar.height,
            paddingTop: tabBar.paddingTop,
            paddingBottom: tabBar.paddingBottom,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = index === state.index;
          const { options } = descriptors[route.key];
          const color = focused ? colors.primary : colors.textMuted;
          const label = typeof options.title === 'string' ? options.title : route.name;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.dispatch({
                    type: 'NAVIGATE',
                    target: state.key,
                    payload: { name: route.name, params: route.params },
                  });
                }
              }}
              onLongPress={() => {
                navigation.emit({ type: 'tabLongPress', target: route.key });
              }}
              style={styles.item}
            >
              {options.tabBarIcon?.({ focused, color, size: TAB_ICON_SIZE })}
              <Text
                style={[
                  typography.label,
                  styles.label,
                  {
                    color,
                    fontSize: tabBar.labelFontSize,
                    lineHeight: tabBar.labelLineHeight,
                  },
                ]}
                numberOfLines={1}
                // useTabBarLayout already applies the (capped) system text scale; letting
                // RN scale again would overflow the bar and ellipsize the labels.
                allowFontScaling={false}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: TAB_ICON_LABEL_GAP,
  },
  label: {
    includeFontPadding: false,
  },
});
