/**
 * MuscleOS color palette — edit hex values here.
 *
 * `buildThemeColors()` derives rgba surfaces, borders, and UI tints automatically.
 * Screens should use `useTheme().colors` only — never hardcode hex in components.
 */

export type ColorMode = 'dark' | 'light';

/** Raw hex palette for one mode. Add keys here when introducing new brand colors. */
export type PaletteBase = {
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryDim: string;
  primaryOn: string;
  accent: string;
  accentDim: string;
  danger: string;
  warning: string;
  success: string;
  successOn: string;
  muscleHighlight: string;
  muscleRecovering: string;
  recoveryHot: string;
  recoveryWarm: string;
  recoveryReady: string;
  bodyDiagramBorder: string;
  bodyDiagramFill: string;
};

/** Mode-specific UI tints (tables, set rows, overlays). */
export type PaletteUi = {
  tableHeader: string;
  rowWarmUp: string;
  rowFuture: string;
  inputBorder: string;
  overlay: string;
};

export type PaletteAlpha = {
  primarySurface: number;
  primaryBorder: number;
  successSurface: number;
};

export type PaletteConfig = {
  id: string;
  name: string;
  alpha: PaletteAlpha;
  dark: PaletteBase;
  light: PaletteBase;
  ui: Record<ColorMode, PaletteUi>;
};

/** ← Adjust colors here. Derived tokens update automatically. */
export const paletteConfig: PaletteConfig = {
  id: 'pulse',
  name: 'Pulse',
  alpha: {
    primarySurface: 0.1,
    primaryBorder: 0.22,
    successSurface: 0.08,
  },
  dark: {
    background: '#14161E',
    surface: '#1C1F2A',
    surfaceElevated: '#252936',
    border: '#353A4A',
    text: '#EDEFF5',
    textSecondary: '#A8ADBD',
    textMuted: '#6E7384',
    primary: '#5694F5',
    primaryDim: '#4580E0',
    primaryOn: '#FFFFFF',
    accent: '#7EB4FF',
    accentDim: '#5C9AFF',
    danger: '#FF4757',
    warning: '#FFB020',
    success: '#3DD68C',
    successOn: '#FFFFFF',
    muscleHighlight: '#3DD68C',
    muscleRecovering: '#FFB020',
    recoveryHot: '#FF4757',
    recoveryWarm: '#FFB020',
    recoveryReady: '#3DD68C',
    bodyDiagramBorder: '#454A5A',
    bodyDiagramFill: '#5A6070',
  },
  light: {
    background: '#F2F4FA',
    surface: '#FFFFFF',
    surfaceElevated: '#EAEEF8',
    border: '#D6DCE8',
    text: '#0C0C14',
    textSecondary: '#4A4A5E',
    textMuted: '#72728A',
    primary: '#2563EB',
    primaryDim: '#1D4ED8',
    primaryOn: '#FFFFFF',
    accent: '#60A5FA',
    accentDim: '#3B82F6',
    danger: '#DC2626',
    warning: '#D97706',
    success: '#059669',
    successOn: '#FFFFFF',
    muscleHighlight: '#059669',
    muscleRecovering: '#D97706',
    recoveryHot: '#DC2626',
    recoveryWarm: '#D97706',
    recoveryReady: '#059669',
    bodyDiagramBorder: '#B8BCC8',
    bodyDiagramFill: '#C8CCD8',
  },
  ui: {
    dark: {
      tableHeader: 'rgba(255,255,255,0.04)',
      rowWarmUp: 'rgba(255,255,255,0.04)',
      rowFuture: 'rgba(255,255,255,0.03)',
      inputBorder: '#353A4A',
      overlay: 'rgba(0,0,0,0.55)',
    },
    light: {
      tableHeader: '#EEF1F8',
      rowWarmUp: '#F7F8FA',
      rowFuture: '#F2F4F8',
      inputBorder: '#CBD5E1',
      overlay: 'rgba(0,0,0,0.45)',
    },
  },
};

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Build an rgba() string from a hex color and alpha (0–1). */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export type ThemeColors = PaletteBase & {
  primarySurface: string;
  primaryBorder: string;
  successSurface: string;
  tableHeader: string;
  rowWarmUp: string;
  rowFuture: string;
  inputBorder: string;
  overlay: string;
};

export function buildThemeColors(mode: ColorMode): ThemeColors {
  const base = paletteConfig[mode];
  const ui = paletteConfig.ui[mode];
  const { alpha } = paletteConfig;

  return {
    ...base,
    primarySurface: withAlpha(base.primary, alpha.primarySurface),
    primaryBorder: withAlpha(base.primary, alpha.primaryBorder),
    successSurface: withAlpha(base.success, alpha.successSurface),
    tableHeader: ui.tableHeader,
    rowWarmUp: ui.rowWarmUp,
    rowFuture: ui.rowFuture,
    inputBorder: ui.inputBorder,
    overlay: ui.overlay,
  };
}

export const darkThemeColors = buildThemeColors('dark');
export const lightThemeColors = buildThemeColors('light');

/** Boot splash — matches dark palette before ThemeProvider mounts. */
export const brandColors = {
  background: paletteConfig.dark.background,
  primary: paletteConfig.dark.primary,
} as const;
