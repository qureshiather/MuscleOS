/** Olympic barbell weight in kg */
export const BAR_WEIGHT_KG = 20;

/** Standard plate weights in kg (each side). Order for greedy algorithm: largest first. */
export const PLATE_WEIGHTS_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

export interface PlateLoad {
  weightKg: number;
  platesPerSide: { kg: number; count: number }[];
  totalPerSide: number;
}

/**
 * Given total barbell load (bar + plates) in kg, returns plates to put on each side.
 * Assumes symmetric loading.
 */
export function getPlatesForWeight(totalKg: number, barKg: number = BAR_WEIGHT_KG): PlateLoad | null {
  if (totalKg <= barKg) return null;
  const perSide = (totalKg - barKg) / 2;
  if (perSide <= 0) return null;

  const platesPerSide: { kg: number; count: number }[] = [];
  let remaining = perSide;

  for (const plate of PLATE_WEIGHTS_KG) {
    const count = Math.floor(remaining / plate);
    if (count > 0) {
      platesPerSide.push({ kg: plate, count });
      remaining = Math.round((remaining - count * plate) * 100) / 100;
    }
  }

  const totalPerSide = platesPerSide.reduce((s, p) => s + p.kg * p.count, 0);
  return {
    weightKg: totalKg,
    platesPerSide,
    totalPerSide,
  };
}
