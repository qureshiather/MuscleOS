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

/**
 * Biodata editor → stored profile (kg). Weight must be > 0 and age > 0 and < 150; anything else
 * (blank, junk, out of range) clears that field. Gender keeps the previous value when none is
 * picked, so once set it can be changed but not cleared.
 */
export function buildProfileFromInputs(
  inputs: BiodataInputs,
  units: BiodataUnits,
  prev: UserAppProfile
): UserAppProfile {
  const w = Number.parseFloat(inputs.weight);
  const a = Number.parseInt(inputs.age, 10);
  const next: UserAppProfile = { ...prev };
  if (!Number.isNaN(w) && w > 0) next.weightKg = displayToKg(w, units.bodyWeightUnit);
  else delete next.weightKg;
  if (!Number.isNaN(a) && a > 0 && a < 150) next.age = a;
  else delete next.age;
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
