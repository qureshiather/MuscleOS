import { muscleLabel, type MuscleId } from '@muscleos/types';
import type { ThemeColors } from '@/theme/palette';

/** Coarse training region used to give a template a consistent accent color. */
export type TrainingRegion = 'push' | 'pull' | 'legs' | 'core' | 'mixed';

const REGION_BY_MUSCLE: Record<MuscleId, Exclude<TrainingRegion, 'mixed'>> = {
  chest: 'push',
  front_delts: 'push',
  side_delts: 'push',
  triceps: 'push',
  rear_delts: 'pull',
  traps: 'pull',
  lats: 'pull',
  rhomboids: 'pull',
  biceps: 'pull',
  forearms: 'pull',
  abs: 'core',
  obliques: 'core',
  lower_back: 'core',
  quads: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
};

/**
 * A template only earns a region color when one region covers most of its work.
 * Full-body templates fall through to `mixed` so the grid never looks like a rainbow.
 */
const DOMINANCE_THRESHOLD = 0.5;

/**
 * Dominant training region for a list of worked muscles.
 * Pass muscles with duplicates included — repetition is the signal for dominance.
 */
export function getTrainingRegion(muscleIds: readonly MuscleId[]): TrainingRegion {
  if (muscleIds.length === 0) return 'mixed';

  const counts = new Map<TrainingRegion, number>();
  for (const id of muscleIds) {
    const region = REGION_BY_MUSCLE[id];
    if (region) counts.set(region, (counts.get(region) ?? 0) + 1);
  }

  let best: TrainingRegion = 'mixed';
  let bestCount = 0;
  let total = 0;
  for (const [region, count] of counts) {
    total += count;
    if (count > bestCount) {
      best = region;
      bestCount = count;
    }
  }

  if (total === 0) return 'mixed';
  return bestCount / total >= DOMINANCE_THRESHOLD ? best : 'mixed';
}

export function regionForMuscle(id: MuscleId): TrainingRegion {
  return REGION_BY_MUSCLE[id] ?? 'mixed';
}

export type MuscleShare = {
  id: MuscleId;
  region: TrainingRegion;
  /** Fraction of the template's total muscle work, 0–1. */
  share: number;
};

/**
 * How a template's work splits across its most-trained muscles. Drives the load bar,
 * so a chest-heavy day reads visibly different from an even full-body session.
 */
export function muscleDistribution(
  muscleIds: readonly MuscleId[],
  limit = 4
): MuscleShare[] {
  if (muscleIds.length === 0) return [];

  const counts = new Map<MuscleId, number>();
  for (const id of muscleIds) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const shown = ranked.reduce((sum, [, count]) => sum + count, 0);
  if (shown === 0) return [];

  return ranked.map(([id, count]) => ({
    id,
    region: regionForMuscle(id),
    share: count / shown,
  }));
}

export function regionColor(region: TrainingRegion, colors: ThemeColors): string {
  switch (region) {
    case 'push':
      return colors.regionPush;
    case 'pull':
      return colors.regionPull;
    case 'legs':
      return colors.regionLegs;
    case 'core':
      return colors.regionCore;
    case 'mixed':
      return colors.regionMixed;
  }
}

/**
 * The muscles a template trains most, as display labels, ordered by how much of
 * the work they account for. Used as the card's at-a-glance identity line.
 */
export function topMuscleLabels(muscleIds: readonly MuscleId[], limit = 3): string[] {
  const counts = new Map<MuscleId, number>();
  for (const id of muscleIds) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => muscleLabel(id));
}
