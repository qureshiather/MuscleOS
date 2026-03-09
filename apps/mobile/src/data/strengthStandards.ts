/**
 * Strength standards: 1RM / bodyweight ratios by level.
 * Based on ExRx.net and common powerlifting/weightlifting classification systems.
 * Standards are for adult lifters (>18); age not differentiated.
 *
 * Exercise IDs map to standards. Unmapped exercises show no comparison.
 */
export type StrengthLevel =
  | 'untrained'
  | 'novice'
  | 'intermediate'
  | 'advanced'
  | 'elite';

export interface StrengthStandard {
  /** 1RM / bodyweight ratio */
  ratio: number;
  level: StrengthLevel;
}

export const STRENGTH_LEVEL_LABELS: Record<StrengthLevel, string> = {
  untrained: 'Untrained',
  novice: 'Novice',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  elite: 'Elite',
};

export const STRENGTH_LEVEL_ORDER: StrengthLevel[] = [
  'untrained',
  'novice',
  'intermediate',
  'advanced',
  'elite',
];

/** Male standards: 1RM/bodyweight ratio per level */
const MALE_STANDARDS: Record<string, Record<StrengthLevel, number>> = {
  'bench-press': { untrained: 0.5, novice: 0.75, intermediate: 1.25, advanced: 1.75, elite: 2.0 },
  'close-grip-bench': { untrained: 0.45, novice: 0.7, intermediate: 1.15, advanced: 1.6, elite: 1.85 },
  squat: { untrained: 0.75, novice: 1.0, intermediate: 1.75, advanced: 2.25, elite: 2.5 },
  deadlift: { untrained: 1.0, novice: 1.25, intermediate: 2.0, advanced: 2.5, elite: 3.0 },
  'romanian-deadlift': { untrained: 0.6, novice: 0.85, intermediate: 1.4, advanced: 1.8, elite: 2.2 },
  'overhead-press': { untrained: 0.35, novice: 0.5, intermediate: 0.75, advanced: 1.0, elite: 1.2 },
  'barbell-row': { untrained: 0.5, novice: 0.75, intermediate: 1.0, advanced: 1.4, elite: 1.75 },
  'pull-up': { untrained: 0.0, novice: 0.0, intermediate: 0.0, advanced: 0.0, elite: 0.0 }, // bodyweight; ratios don't apply
};

/** Female standards: ~60–70% of male (based on physiological differences) */
const FEMALE_STANDARDS: Record<string, Record<StrengthLevel, number>> = {
  'bench-press': { untrained: 0.3, novice: 0.45, intermediate: 0.75, advanced: 1.15, elite: 1.5 },
  'close-grip-bench': { untrained: 0.25, novice: 0.4, intermediate: 0.65, advanced: 1.0, elite: 1.3 },
  squat: { untrained: 0.5, novice: 0.75, intermediate: 1.25, advanced: 1.75, elite: 2.25 },
  deadlift: { untrained: 0.65, novice: 0.95, intermediate: 1.5, advanced: 2.0, elite: 2.5 },
  'romanian-deadlift': { untrained: 0.4, novice: 0.6, intermediate: 1.0, advanced: 1.3, elite: 1.6 },
  'overhead-press': { untrained: 0.2, novice: 0.3, intermediate: 0.55, advanced: 0.75, elite: 1.0 },
  'barbell-row': { untrained: 0.3, novice: 0.5, intermediate: 0.7, advanced: 1.0, elite: 1.3 },
  'pull-up': { untrained: 0.0, novice: 0.0, intermediate: 0.0, advanced: 0.0, elite: 0.0 },
};

export interface StrengthComparison {
  /** Your 1RM / bodyweight ratio */
  ratio: number;
  /** Detected level based on standards */
  level: StrengthLevel;
  /** 1RM required for next level (kg), or null if elite */
  nextLevel1RMKg: number | null;
  /** Next level name */
  nextLevelName: string | null;
  /** Whether standards are available for this exercise */
  hasStandards: boolean;
}

/**
 * Get strength standards for an exercise and sex.
 * Returns null if no standards exist (e.g. isolation exercises).
 */
export function getStrengthStandards(
  exerciseId: string,
  sex: 'male' | 'female'
): Record<StrengthLevel, number> | null {
  const standards =
    sex === 'female' ? FEMALE_STANDARDS[exerciseId] : MALE_STANDARDS[exerciseId];
  return standards ?? null;
}

/**
 * Compare user's 1RM to strength standards.
 * Requires bodyweight (kg) and sex from profile.
 */
export function compareToStrengthStandards(
  exerciseId: string,
  oneRepMaxKg: number,
  bodyweightKg: number,
  sex: 'male' | 'female'
): StrengthComparison {
  const standards = getStrengthStandards(exerciseId, sex);
  const ratio = bodyweightKg > 0 ? oneRepMaxKg / bodyweightKg : 0;

  if (!standards) {
    return {
      ratio,
      level: 'untrained',
      nextLevel1RMKg: null,
      nextLevelName: null,
      hasStandards: false,
    };
  }

  let detectedLevel: StrengthLevel = 'untrained';
  let nextLevel1RMKg: number | null = null;
  let nextLevelName: string | null = null;

  for (let i = STRENGTH_LEVEL_ORDER.length - 1; i >= 0; i--) {
    const level = STRENGTH_LEVEL_ORDER[i];
    const requiredRatio = standards[level];
    if (requiredRatio > 0 && ratio >= requiredRatio) {
      detectedLevel = level;
      break;
    }
  }

  const nextIdx = STRENGTH_LEVEL_ORDER.indexOf(detectedLevel) + 1;
  if (nextIdx < STRENGTH_LEVEL_ORDER.length) {
    const nextLevel = STRENGTH_LEVEL_ORDER[nextIdx];
    const nextRatio = standards[nextLevel];
    if (nextRatio > 0) {
      nextLevel1RMKg = bodyweightKg * nextRatio;
      nextLevelName = STRENGTH_LEVEL_LABELS[nextLevel];
    }
  }

  return {
    ratio,
    level: detectedLevel,
    nextLevel1RMKg,
    nextLevelName,
    hasStandards: true,
  };
}
