export type WeightUnit = 'kg' | 'lb';
export type HeightUnit = 'cm' | 'in';

const KG_TO_LB = 2.20462;
const CM_TO_IN = 1 / 2.54;

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

/** Convert stored cm to display value in user's height unit */
export function cmToDisplay(cm: number, unit: HeightUnit): number {
  if (unit === 'in') return Math.round(cm * CM_TO_IN * 10) / 10;
  return Math.round(cm * 10) / 10;
}

/** Convert display value (in user's height unit) to cm for storage */
export function displayToCm(display: number, unit: HeightUnit): number {
  if (unit === 'in') return Math.round((display / CM_TO_IN) * 100) / 100;
  return display;
}

/** Format height for display (e.g. "175 cm" or "69 in") */
export function formatHeight(cm: number, unit: HeightUnit): string {
  const value = cmToDisplay(cm, unit);
  return `${value} ${unit === 'in' ? 'in' : 'cm'}`;
}
