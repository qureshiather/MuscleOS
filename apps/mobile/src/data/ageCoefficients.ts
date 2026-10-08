/**
 * Powerlifting age coefficients: how much a lifter's 1RM is scaled up to compare with a lifter in
 * their prime (23–40, coefficient 1). Published tables only:
 *
 * - 14–22: Foster coefficients (teen and junior divisions)
 * - 41–80: McCulloch coefficients (masters), as corrected against the WPC Glossbrenner masters table
 * - 81–90: USAPL age coefficients
 *
 * Compiled from OpenPowerlifting's coefficients table (crates/coefficients/src/mcculloch.rs), which
 * cites each source. Ages outside 14–90 have no published coefficient: under 14 gets no strength
 * comparison at all, and over 90 uses the age-90 value.
 */
export const MIN_STANDARDS_AGE = 14;
export const MAX_COEFFICIENT_AGE = 90;

const FOSTER: Record<number, number> = {
  14: 1.23,
  15: 1.18,
  16: 1.13,
  17: 1.08,
  18: 1.06,
  19: 1.04,
  20: 1.03,
  21: 1.02,
  22: 1.01,
};

/** Index 0 is age 41. */
const MASTERS = [
  1.01, 1.02, 1.031, 1.043, 1.055, 1.068, 1.082, 1.097, 1.113, 1.13, // 41–50
  1.147, 1.165, 1.184, 1.204, 1.225, 1.246, 1.268, 1.291, 1.315, 1.34, // 51–60
  1.366, 1.393, 1.421, 1.45, 1.48, 1.511, 1.543, 1.576, 1.61, 1.645, // 61–70
  1.681, 1.718, 1.756, 1.795, 1.835, 1.876, 1.918, 1.961, 2.005, 2.05, // 71–80
  2.096, 2.143, 2.19, 2.238, 2.287, 2.337, 2.388, 2.44, 2.494, 2.549, // 81–90
];

/**
 * The coefficient for a whole-year age, or null under 14 (no published standard applies).
 * 23–40 is 1; above 90 stays at the age-90 value.
 */
export function ageCoefficient(age: number): number | null {
  const years = Math.floor(age);
  if (years < MIN_STANDARDS_AGE) return null;
  if (years <= 22) return FOSTER[years];
  if (years <= 40) return 1;
  return MASTERS[Math.min(years, MAX_COEFFICIENT_AGE) - 41];
}
