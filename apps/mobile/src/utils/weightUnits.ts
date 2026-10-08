export type WeightUnit = 'kg' | 'lb';

export const KG_TO_LB = 2.20462;

/**
 * Convert stored kg to the display value in the user's unit.
 * Pounds keep 1 decimal (2.5 lb plate steps). Kilograms keep 2 (0.25 kg plate steps).
 */
export function kgToDisplay(kg: number, unit: WeightUnit): number {
  if (unit === 'lb') return Math.round(kg * KG_TO_LB * 10) / 10;
  return Math.round(kg * 100) / 100;
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
