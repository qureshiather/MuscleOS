export type WeightUnit = 'kg' | 'lb';

const KG_TO_LB = 2.20462;

/** Convert stored kg to display value in user's unit */
export function kgToDisplay(kg: number, unit: WeightUnit): number {
  if (unit === 'lb') return Math.round(kg * KG_TO_LB * 10) / 10;
  return Math.round(kg * 10) / 10;
}

/** Convert display value (in user's unit) to kg for storage */
export function displayToKg(display: number, unit: WeightUnit): number {
  if (unit === 'lb') return Math.round((display / KG_TO_LB) * 100) / 100;
  return display;
}

/** Format weight for display (e.g. "82.5 kg" or "182 lb") */
export function formatWeight(kg: number, unit: WeightUnit): string {
  const value = kgToDisplay(kg, unit);
  return `${value} ${unit}`;
}
