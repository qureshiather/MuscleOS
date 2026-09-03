/**
 * Presentation-layer layout primitives.
 *
 * Everything here answers "how much room do I have?" — device size classes, the system
 * text-size multiplier, safe-area insets and tab bar measurements. Screens and
 * components read these instead of hardcoding pixel values, so the UI holds up from a
 * 320pt iPhone SE through a Galaxy S26 Ultra, and with iOS Display Zoom / Android
 * Display Size and enlarged system text.
 *
 * No domain logic belongs in this file.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  StyleSheet,
  useWindowDimensions,
  type KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from './tokens';
import { typography } from './typography';

// ---------------------------------------------------------------------------
// Device size classes
// ---------------------------------------------------------------------------

/** iPhone SE (1st gen) and small Androids; also where iOS Display Zoom lands. */
const NARROW_WIDTH = 360;
/** iPhone SE 2/3 and iPhone 13 mini sit just under this. */
const COMPACT_WIDTH = 390;
/** Below this the vertical rhythm has to tighten (iPhone SE is 568pt tall). */
const SHORT_HEIGHT = 700;

export type DeviceMetrics = {
  width: number;
  height: number;
  /** System text-size multiplier: iOS Dynamic Type, Android font size. */
  fontScale: number;
  /** ~320-360pt wide. Fixed multi-column layouts overflow here. */
  isNarrow: boolean;
  /** Under 390pt. Roomier than narrow, still not a modern flagship. */
  isCompact: boolean;
  /** Short screens where tall fixed blocks push content off-screen. */
  isShort: boolean;
  /** The user has enlarged system text. */
  hasLargeText: boolean;
};

/**
 * Reactive device metrics. Uses `useWindowDimensions` rather than `Dimensions.get` so
 * the UI re-lays-out when Display Zoom / Display Size / text size change at runtime.
 */
export function useDeviceMetrics(): DeviceMetrics {
  const { width, height, fontScale } = useWindowDimensions();

  return {
    width,
    height,
    fontScale,
    isNarrow: width < NARROW_WIDTH,
    isCompact: width < COMPACT_WIDTH,
    isShort: height < SHORT_HEIGHT,
    hasLargeText: fontScale > 1.15,
  };
}

// ---------------------------------------------------------------------------
// System text size
// ---------------------------------------------------------------------------

/**
 * Caps for the `maxFontSizeMultiplier` prop on `Text` / `TextInput`.
 *
 * Prefer fixing the container so text can grow freely. Reach for a cap only where the
 * geometry genuinely cannot flex — a table column, a calendar cell, a chart axis — and
 * use the loosest one that still fits.
 */
export const fontScaleCap = {
  /** Fixed-size geometry: table headers, calendar day cells, chart labels. */
  fixed: 1.2,
  /** Single-line chrome: tab labels, chips, badges, compact stat values. */
  chrome: 1.4,
  /** Dense numeric input that shares a row with several siblings. */
  tabular: 1.5,
} as const;

/** Clamp the system text scale when sizing a container that can't reflow. */
export function useClampedFontScale(max: number = fontScaleCap.fixed): number {
  const { fontScale } = useWindowDimensions();
  return Math.min(Math.max(fontScale, 1), max);
}

/**
 * Scale a fixed dimension by the clamped system text scale, so a box that must hold
 * text grows with the user's setting instead of clipping it.
 */
export function useTextScaledSize(size: number, max: number = fontScaleCap.fixed): number {
  const scale = useClampedFontScale(max);
  return Math.round(size * scale);
}

// ---------------------------------------------------------------------------
// Available width
// ---------------------------------------------------------------------------

/**
 * Width left for content once the screen's horizontal padding is removed. Charts and
 * diagrams size themselves from this instead of assuming a phone width.
 */
export function useContentWidth(horizontalPadding: number = spacing.lg * 2): number {
  const { width } = useWindowDimensions();
  return Math.max(0, width - horizontalPadding);
}

// ---------------------------------------------------------------------------
// Safe area
// ---------------------------------------------------------------------------

/**
 * Bottom padding for surfaces that own their bottom edge — screens outside the tab
 * navigator, pinned footers and bottom sheets. `base` is the visual padding you want
 * on a device with no bottom inset.
 */
export function useBottomSpace(base = 0): number {
  const insets = useSafeAreaInsets();
  return base + insets.bottom;
}

/**
 * Horizontal page gutter. Tightens on narrow / Display-Zoom widths so two-column
 * cards and five-tab labels still fit.
 */
export function useScreenGutter(): number {
  const { isNarrow } = useDeviceMetrics();
  return isNarrow ? spacing.md : spacing.lg;
}

/**
 * Bottom padding for scroll content. Tab screens already sit above the tab bar, so
 * they only need visual breathing room. Stack screens also reserve the home indicator.
 */
export function useScrollBottomPadding(kind: 'tab' | 'stack' = 'stack'): number {
  const inset = useBottomSpace(spacing.xxl);
  return kind === 'tab' ? spacing.xxl : inset;
}

/**
 * Column and control sizes for a dense numeric row (set table, similar chrome).
 * Scales with system text, then tightens on Display Zoom / SE-class widths.
 */
export function useDenseRowMetrics() {
  const scale = useClampedFontScale(fontScaleCap.tabular);
  const { isNarrow } = useDeviceMetrics();

  return {
    rowMin: Math.round(40 * scale),
    inputMinHeight: Math.round(36 * scale),
    doneBtn: Math.round(36 * scale),
    setCol: Math.round((isNarrow ? 28 : 32) * scale),
    prevMin: Math.round((isNarrow ? 52 : 64) * scale),
    inputMin: Math.round((isNarrow ? 44 : 52) * scale),
  };
}

/**
 * Largest a centered modal or bottom sheet may grow to, leaving room for the status
 * bar, the home indicator and a little breathing space. Percentage heights leave too
 * little on short phones and waste space on tall ones.
 */
export function useModalMaxHeight(reserve = spacing.xxl * 2): number {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return Math.max(240, height - insets.top - insets.bottom - reserve);
}

/**
 * How much the keyboard still covers the window. Uses the keyboard's reported
 * height (not screenY) so Modal windows and scaled simulators stay correct.
 * On Android `adjustResize` already shrinks the window; we subtract that shrink
 * so callers do not double-pad.
 *
 * Hide listeners must set 0 themselves — iOS `keyboardWillHide` still reports
 * the keyboard height in `endCoordinates`.
 */
export function useKeyboardOverlap(): number {
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const restWindowHeightRef = useRef(windowHeight);

  useEffect(() => {
    if (keyboardHeight === 0) {
      restWindowHeightRef.current = windowHeight;
    }
  }, [keyboardHeight, windowHeight]);

  useEffect(() => {
    const onShow = (e: KeyboardEvent) => {
      setKeyboardHeight(e.endCoordinates.height);
    };
    const onHide = () => {
      setKeyboardHeight(0);
    };
    const subs = [
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', onShow),
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', onHide),
    ];
    if (Platform.OS === 'ios') {
      // Modal windows sometimes skip the "will" events.
      subs.push(Keyboard.addListener('keyboardDidShow', onShow));
      subs.push(Keyboard.addListener('keyboardDidHide', onHide));
    }
    return () => {
      for (const sub of subs) sub.remove();
    };
  }, []);

  if (keyboardHeight <= 0) return 0;
  // iOS Modal is a separate window and does not shrink with the keyboard, even
  // when useWindowDimensions on the main window does. Always lift by the
  // keyboard height there. On Android adjustResize, subtract the window shrink
  // so we do not pad twice.
  if (Platform.OS === 'ios') return keyboardHeight;
  const windowShrink = Math.max(0, restWindowHeightRef.current - windowHeight);
  return Math.max(0, keyboardHeight - windowShrink);
}

// ---------------------------------------------------------------------------
// Bottom tab bar
// ---------------------------------------------------------------------------

/** Height of the icon block rendered by @react-navigation/bottom-tabs (uikit variant). */
const TAB_ICON_HEIGHT = 28;
/** Vertical padding the library applies inside every tab item. */
const TAB_ITEM_PADDING = 5;
/** Breathing room between the top border of the bar and the icons. */
const TAB_BAR_PADDING_TOP = spacing.xs;
/**
 * Android clips children that overflow their parent, so the bar must be tall enough
 * for the label at the user's text size. Capped because five labels stop fitting side
 * by side beyond this, and an ellipsized label reads worse than a smaller one.
 */
const MAX_TAB_LABEL_FONT_SCALE = 1.15;

export type TabBarLayout = {
  /** Total bar height, safe-area inset included. */
  height: number;
  paddingTop: number;
  /** Reserves the Android navigation bar / iOS home indicator. */
  paddingBottom: number;
  labelFontSize: number;
  labelLineHeight: number;
};

/**
 * Measurements for the bottom tab bar. The library sizes the bar from a fixed iOS
 * height that assumes a 10pt label, which truncates our larger labels and pushes them
 * into the navigation bar. Sizing it from the real content keeps every device correct.
 */
export function useTabBarLayout(): TabBarLayout {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();

  const baseFontSize =
    width < NARROW_WIDTH ? typography.caption.fontSize - 2 : typography.caption.fontSize;
  const scale = Math.min(Math.max(fontScale, 1), MAX_TAB_LABEL_FONT_SCALE);
  const labelFontSize = Math.round(baseFontSize * scale);
  const labelLineHeight = Math.ceil(labelFontSize * 1.4);

  const contentHeight =
    TAB_BAR_PADDING_TOP + TAB_ITEM_PADDING * 2 + TAB_ICON_HEIGHT + labelLineHeight;

  return {
    height: contentHeight + insets.bottom + StyleSheet.hairlineWidth,
    paddingTop: TAB_BAR_PADDING_TOP,
    paddingBottom: insets.bottom,
    labelFontSize,
    labelLineHeight,
  };
}
