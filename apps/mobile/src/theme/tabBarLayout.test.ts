import { describe, expect, it } from 'vitest';
import {
  computeTabBarLayout,
  TAB_BAR_PADDING_Y,
  TAB_ICON_LABEL_GAP,
  TAB_ICON_SIZE,
} from './tabBarLayout';

const base = { labelBaseFontSize: 13, fontScale: 1, hairline: 0 };

describe('computeTabBarLayout', () => {
  it('pads the bottom like the top when the device reports no inset', () => {
    const layout = computeTabBarLayout({ ...base, bottomInset: 0 });
    expect(layout.paddingBottom).toBe(layout.paddingTop);
    expect(layout.paddingBottom).toBe(TAB_BAR_PADDING_Y);
  });

  it('uses the system inset instead of stacking padding on top of it', () => {
    expect(computeTabBarLayout({ ...base, bottomInset: 34 }).paddingBottom).toBe(34);
    expect(computeTabBarLayout({ ...base, bottomInset: 4 }).paddingBottom).toBe(TAB_BAR_PADDING_Y);
  });

  it('sizes the bar to exactly fit padding, icon, gap and label', () => {
    const layout = computeTabBarLayout({ ...base, bottomInset: 24, hairline: 0.5 });
    expect(layout.height).toBe(
      0.5 + layout.paddingTop + TAB_ICON_SIZE + TAB_ICON_LABEL_GAP + layout.labelLineHeight + 24
    );
  });

  it('grows the label with system text, capped at 1.15x', () => {
    expect(computeTabBarLayout({ ...base, bottomInset: 0, fontScale: 1.1 }).labelFontSize).toBe(14);
    expect(computeTabBarLayout({ ...base, bottomInset: 0, fontScale: 2 }).labelFontSize).toBe(15);
    expect(computeTabBarLayout({ ...base, bottomInset: 0, fontScale: 0.8 }).labelFontSize).toBe(13);
  });
});
