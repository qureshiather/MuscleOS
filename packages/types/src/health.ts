export interface MacroTargets {
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MetabolismInfo {
  /** BMR in kcal (e.g. Mifflin-St Jeor) */
  bmrKcal?: number;
  /** TDEE estimate if provided */
  tdeeKcal?: number;
  /** Height in cm */
  heightCm?: number;
  /** Weight in kg */
  weightKg?: number;
  /** Age */
  age?: number;
  /** Male / female / other for BMR */
  sex?: 'male' | 'female' | 'other';
}
