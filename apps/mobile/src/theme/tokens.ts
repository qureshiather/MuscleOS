/** Spacing scale (4pt grid). Colors: see `palette.ts`. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Border radius — three sizes only */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

/** Touch-target minima (Apple HIG / Material). Use for chrome, not body copy. */
export const touch = {
  min: 44,
  hitSlop: 8,
} as const;
