/**
 * Pure bottom tab bar measurements. Kept free of react-native imports so the sizing
 * rules are unit-testable; `useTabBarLayout` in `layout.ts` feeds in the live values.
 */

import { spacing } from './tokens';

/** Icon size rendered by `TabBarWithResumePill`. */
export const TAB_ICON_SIZE = 28;
/** Space between a tab's icon and its label. */
export const TAB_ICON_LABEL_GAP = spacing.xs / 2;
/**
 * Breathing room above the tab content, and the minimum below it. Devices that report
 * no bottom inset (Samsung with gesture hints hidden, Androids with an overlay nav bar)
 * would otherwise pin the labels to the screen edge.
 */
export const TAB_BAR_PADDING_Y = spacing.sm;
/**
 * Android clips children that overflow their parent, so the bar must be tall enough
 * for the label at the user's text size. Capped because five labels stop fitting side
 * by side beyond this, and an ellipsized label reads worse than a smaller one.
 */
export const MAX_TAB_LABEL_FONT_SCALE = 1.15;

export type TabBarLayout = {
  /** Total bar height, safe-area inset included. */
  height: number;
  paddingTop: number;
  /** Reserves the Android navigation bar / iOS home indicator; never less than the top. */
  paddingBottom: number;
  labelFontSize: number;
  labelLineHeight: number;
};

/**
 * The icon + label block sits centred between equal top and bottom padding. A larger
 * system inset replaces the bottom padding rather than stacking on it, so iPhones and
 * gesture-bar Androids keep their current height.
 */
export function computeTabBarLayout({
  labelBaseFontSize,
  fontScale,
  bottomInset,
  hairline,
}: {
  labelBaseFontSize: number;
  fontScale: number;
  bottomInset: number;
  hairline: number;
}): TabBarLayout {
  const scale = Math.min(Math.max(fontScale, 1), MAX_TAB_LABEL_FONT_SCALE);
  const labelFontSize = Math.round(labelBaseFontSize * scale);
  const labelLineHeight = Math.ceil(labelFontSize * 1.4);

  const contentHeight = TAB_ICON_SIZE + TAB_ICON_LABEL_GAP + labelLineHeight;
  const paddingTop = TAB_BAR_PADDING_Y;
  const paddingBottom = Math.max(bottomInset, TAB_BAR_PADDING_Y);

  return {
    height: hairline + paddingTop + contentHeight + paddingBottom,
    paddingTop,
    paddingBottom,
    labelFontSize,
    labelLineHeight,
  };
}
