/**
 * Pure column sizing for the dense set table. Kept free of react-native imports so the
 * rules are unit-testable; `useDenseRowMetrics` in `layout.ts` feeds in the live values.
 */

/** Largest system text scale the table grows with. */
export const DENSE_ROW_MAX_FONT_SCALE = 1.5;
/** Below this width the base columns start narrower (iPhone SE 1st gen, Display Zoom). */
const NARROW_WIDTH = 360;
/** Space between columns; the row has four gaps (five columns). */
export const DENSE_ROW_COL_GAP = 8;
/**
 * Horizontal space the active workout spends around the row: list padding (8 + 8), the
 * card border (1 + 1) and the row's own padding (10 + 10).
 */
export const DENSE_ROW_CHROME = 38;

/** Columns never shrink below their unscaled narrow-phone size. */
const FLOOR = { setCol: 30, prevMin: 60, inputMin: 52, doneBtn: 42 } as const;

export type DenseRowMetrics = {
  rowMin: number;
  inputMinHeight: number;
  doneBtn: number;
  setCol: number;
  prevMin: number;
  inputMin: number;
};

/**
 * Column and control sizes for a dense numeric row. Heights scale with system text;
 * widths scale too, then shrink back toward their floors when the five columns would
 * no longer fit the screen, so large text on a small phone never pushes the Done
 * button off the edge.
 */
export function computeDenseRowMetrics({
  width,
  fontScale,
}: {
  width: number;
  fontScale: number;
}): DenseRowMetrics {
  const scale = Math.min(Math.max(fontScale, 1), DENSE_ROW_MAX_FONT_SCALE);
  const isNarrow = width < NARROW_WIDTH;

  const wanted = {
    setCol: Math.round((isNarrow ? 30 : 34) * scale),
    prevMin: Math.round((isNarrow ? 60 : 72) * scale),
    inputMin: Math.round((isNarrow ? 52 : 60) * scale),
    doneBtn: Math.round(42 * scale),
  };

  const columnsWidth = (c: typeof wanted) => c.setCol + c.prevMin + 2 * c.inputMin + c.doneBtn;
  const available = width - DENSE_ROW_CHROME - 4 * DENSE_ROW_COL_GAP;
  const overflow = columnsWidth(wanted) - available;

  let cols = wanted;
  if (overflow > 0) {
    // Give back the overflow from each column's room above its floor, proportionally.
    const room = columnsWidth(wanted) - columnsWidth(FLOOR);
    const keep = room > 0 ? Math.max(0, 1 - overflow / room) : 0;
    const fit = (key: keyof typeof wanted) =>
      Math.floor(FLOOR[key] + (wanted[key] - FLOOR[key]) * keep);
    cols = {
      setCol: fit('setCol'),
      prevMin: fit('prevMin'),
      inputMin: fit('inputMin'),
      doneBtn: fit('doneBtn'),
    };
  }

  return {
    rowMin: Math.round(50 * scale),
    inputMinHeight: Math.round(42 * scale),
    ...cols,
  };
}
