/** A value axis: its range and the tick values to label, lowest first. */
export type ValueAxis = { min: number; max: number; ticks: number[] };

/** 1, 2, 2.5 or 5 × a power of ten, the smallest at or above `rough`. */
function niceStep(rough: number): number {
  const power = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

/**
 * A y-axis that fits `values` with round tick labels. It hugs the data rather than starting at
 * zero, so a 107 → 117 change reads as a climb instead of near-equal heights. A flat series gets a
 * small band around its value so the line sits mid-chart.
 */
export function valueAxis(values: readonly number[], targetTicks = 4): ValueAxis {
  if (values.length === 0) return { min: 0, max: 1, ticks: [0, 1] };
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi === lo) {
    const pad = Math.max(Math.abs(lo) * 0.05, 1);
    lo -= pad;
    hi += pad;
  }
  const step = niceStep((hi - lo) / Math.max(1, targetTicks - 1));
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  // Rounded to the step's precision so 0.1 + 0.2 style drift never reaches a label.
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Number(v.toFixed(decimals)));
  return { min, max, ticks };
}

/** A tick value as a label: whole numbers bare, otherwise up to one decimal. */
export function formatTick(value: number): string {
  return String(Math.round(value * 10) / 10);
}
