import type { UserAppProfile } from '@/storage/localStorage';
import { displayToKg, kgToDisplay, type WeightUnit } from '@/utils/weightUnits';

export type BiodataUnits = { bodyWeightUnit: WeightUnit };

export type BiodataInputs = {
  weight: string;
  age: string;
  sex: 'male' | 'female' | null;
};

/** Profile tab hint before any biodata is saved. */
export const BIODATA_EMPTY_HINT = 'Used for strength standards';

/** Accepted biodata ranges, inclusive. Weight is checked in the unit it was typed in. */
export const BIODATA_RANGES = {
  weight: { kg: { min: 30, max: 300 }, lb: { min: 66, max: 660 } },
  age: { min: 13, max: 100 },
} as const;

export type BiodataErrors = { weight?: string; age?: string };

/** Hint under the weight field: "Between 66 and 660 lb". */
export function weightRangeHint(unit: WeightUnit): string {
  const { min, max } = BIODATA_RANGES.weight[unit];
  return `Between ${min} and ${max} ${unit}`;
}

/** Hint under the age field: "Between 13 and 100". */
export function ageRangeHint(): string {
  const { min, max } = BIODATA_RANGES.age;
  return `Between ${min} and ${max}`;
}

/** Strict number parse: blank → null, junk ("80kg", "abc") → NaN. */
function parseInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  return Number(trimmed.replace(',', '.'));
}

function parseWeight(raw: string, unit: WeightUnit): number | null | 'invalid' {
  const w = parseInput(raw);
  if (w == null) return null;
  const { min, max } = BIODATA_RANGES.weight[unit];
  return Number.isFinite(w) && w >= min && w <= max ? w : 'invalid';
}

function parseAge(raw: string): number | null | 'invalid' {
  const a = parseInput(raw);
  if (a == null) return null;
  const { min, max } = BIODATA_RANGES.age;
  return Number.isInteger(a) && a >= min && a <= max ? a : 'invalid';
}

/** Per-field errors for the editor; empty when Save may proceed. Blank fields are valid (they clear). */
export function validateBiodataInputs(inputs: BiodataInputs, units: BiodataUnits): BiodataErrors {
  const errors: BiodataErrors = {};
  if (parseWeight(inputs.weight, units.bodyWeightUnit) === 'invalid') {
    errors.weight = `Enter a weight ${weightRangeHint(units.bodyWeightUnit).toLowerCase()}`;
  }
  if (parseAge(inputs.age) === 'invalid') {
    errors.age = `Enter an age ${ageRangeHint().toLowerCase()}`;
  }
  return errors;
}

/**
 * Biodata editor → stored profile (kg). A blank field clears it; the editor blocks Save on an
 * out-of-range value (`validateBiodataInputs`), and one that slips through is ignored, keeping the
 * saved value. Gender keeps the previous value when none is picked, so once set it can be changed
 * but not cleared.
 */
export function buildProfileFromInputs(
  inputs: BiodataInputs,
  units: BiodataUnits,
  prev: UserAppProfile
): UserAppProfile {
  const next: UserAppProfile = { ...prev };
  const w = parseWeight(inputs.weight, units.bodyWeightUnit);
  if (w == null) delete next.weightKg;
  else if (w !== 'invalid') next.weightKg = displayToKg(w, units.bodyWeightUnit);
  const a = parseAge(inputs.age);
  if (a == null) delete next.age;
  else if (a !== 'invalid') next.age = a;
  const sex = inputs.sex ?? prev.sex;
  if (sex == null) delete next.sex;
  else next.sex = sex;
  return next;
}

export function formatBodyWeight(weightKg: number, unit: WeightUnit): string {
  return `${kgToDisplay(weightKg, unit)} ${unit}`;
}

export function formatSex(sex: UserAppProfile['sex']): string | null {
  return sex === 'female' ? 'Female' : sex === 'male' ? 'Male' : null;
}

/** Profile tab Biodata hint: "80 kg · 30 · Male" for the saved fields, else the default. */
export function biodataSummary(profile: UserAppProfile, units: BiodataUnits): string {
  const parts = [
    profile.weightKg != null ? formatBodyWeight(profile.weightKg, units.bodyWeightUnit) : null,
    profile.age != null ? String(profile.age) : null,
    formatSex(profile.sex),
  ].filter((part): part is string => part != null);
  return parts.length > 0 ? parts.join(' · ') : BIODATA_EMPTY_HINT;
}
