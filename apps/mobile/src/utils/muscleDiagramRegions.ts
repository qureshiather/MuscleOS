import type { MuscleId } from '@muscleos/types';
import type { Slug } from 'react-native-body-highlighter';

/**
 * 18 muscle ids onto 15 diagram regions. Shared regions can't be told apart on the figure:
 * all three delts shade `deltoids`, and lats + rhomboids shade `upper-back`.
 */
export const MUSCLE_ID_TO_DIAGRAM_REGION: Record<MuscleId, Slug> = {
  chest: 'chest',
  front_delts: 'deltoids',
  side_delts: 'deltoids',
  rear_delts: 'deltoids',
  traps: 'trapezius',
  lats: 'upper-back',
  rhomboids: 'upper-back',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearm',
  abs: 'abs',
  obliques: 'obliques',
  lower_back: 'lower-back',
  quads: 'quadriceps',
  hamstrings: 'hamstring',
  glutes: 'gluteal',
  adductors: 'adductors',
  calves: 'calves',
};

/** Recovery state of one diagram region, matching the Recovery tab's three colours. */
export type RegionState = 'ready' | 'recovering' | 'justTrained';

const STATE_RANK: Record<RegionState, number> = { ready: 0, recovering: 1, justTrained: 2 };

/**
 * Diagram regions for a set of muscles, each with its recovery state. Regions shared by several
 * muscles (delts, upper back) take the least-recovered state among them.
 */
export function regionStatesForMuscles(
  muscleIds: readonly MuscleId[],
  recovering: ReadonlySet<MuscleId>,
  justTrained: ReadonlySet<MuscleId>
): Partial<Record<Slug, RegionState>> {
  const states: Partial<Record<Slug, RegionState>> = {};
  for (const id of muscleIds) {
    const slug = MUSCLE_ID_TO_DIAGRAM_REGION[id];
    const state: RegionState = justTrained.has(id) ? 'justTrained' : recovering.has(id) ? 'recovering' : 'ready';
    const prev = states[slug];
    if (!prev || STATE_RANK[state] > STATE_RANK[prev]) states[slug] = state;
  }
  return states;
}

/**
 * The regions a template is mostly about: regions trained by two or more of its exercises. A
 * region only one accessory exercise trains (plank on leg day) is left out so it can't widen the
 * muscle art crop. When no region repeats, every region counts.
 */
export function focusRegions(exerciseMuscles: readonly (readonly MuscleId[])[]): Slug[] {
  const counts = new Map<Slug, number>();
  for (const muscles of exerciseMuscles) {
    for (const slug of new Set(muscles.map((id) => MUSCLE_ID_TO_DIAGRAM_REGION[id]))) {
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }
  const repeated = [...counts].filter(([, n]) => n >= 2).map(([slug]) => slug);
  return repeated.length > 0 ? repeated : [...counts.keys()];
}
