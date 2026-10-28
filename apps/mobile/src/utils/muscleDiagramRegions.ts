import type { MuscleId } from '@muscleos/types';
import type { MuscleRegion } from '@/data/bodyFigures';

/**
 * 20 muscle ids onto 18 diagram regions. All three delts map to `deltoids`, but the figure draws
 * that region on both views, so `MUSCLE_DIAGRAM_VIEW` keeps front and rear delts to their own side.
 * Lats light the large panel down the side of the back; rhomboids light `upper-back`, the
 * shoulder-blade pieces, because the figure has no region between the blades (the traps cover it).
 */
export const MUSCLE_ID_TO_DIAGRAM_REGION: Record<MuscleId, MuscleRegion> = {
  chest: 'chest',
  front_delts: 'deltoids',
  side_delts: 'deltoids',
  rear_delts: 'deltoids',
  neck: 'neck',
  traps: 'trapezius',
  lats: 'lats',
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
  tibialis: 'tibialis',
};

/** One of the two body figures. */
export type DiagramView = 'front' | 'back';

/**
 * Muscles drawn on one view only. The library's `deltoids` region is the front of the shoulder on
 * the front figure and the back of it on the back figure, so front delts shading it on the back
 * view (or rear delts on the front) would light the wrong head. Side delts show on both.
 */
export const MUSCLE_DIAGRAM_VIEW: Partial<Record<MuscleId, DiagramView>> = {
  front_delts: 'front',
  rear_delts: 'back',
};

/** The muscles that shade a region on `view`: everything except muscles pinned to the other view. */
export function musclesOnView(muscleIds: readonly MuscleId[], view: DiagramView): MuscleId[] {
  return muscleIds.filter((id) => (MUSCLE_DIAGRAM_VIEW[id] ?? view) === view);
}

/** Recovery state of one diagram region, matching the Recovery tab's three colours. */
export type RegionState = 'ready' | 'recovering' | 'justTrained';

export type RegionStates = Partial<Record<MuscleRegion, RegionState>>;

const STATE_RANK: Record<RegionState, number> = { ready: 0, recovering: 1, justTrained: 2 };

/**
 * Diagram regions for a set of muscles, each with its recovery state. Regions shared by several
 * muscles (the delts) take the least-recovered state among them.
 */
export function regionStatesForMuscles(
  muscleIds: readonly MuscleId[],
  recovering: ReadonlySet<MuscleId>,
  justTrained: ReadonlySet<MuscleId>
): RegionStates {
  const states: RegionStates = {};
  for (const id of muscleIds) {
    const slug = MUSCLE_ID_TO_DIAGRAM_REGION[id];
    const state: RegionState = justTrained.has(id) ? 'justTrained' : recovering.has(id) ? 'recovering' : 'ready';
    const prev = states[slug];
    if (!prev || STATE_RANK[state] > STATE_RANK[prev]) states[slug] = state;
  }
  return states;
}

/** `regionStatesForMuscles` for each view, so a region drawn on both is coloured per side. */
export function regionStatesByView(
  muscleIds: readonly MuscleId[],
  recovering: ReadonlySet<MuscleId>,
  justTrained: ReadonlySet<MuscleId>
): Record<DiagramView, RegionStates> {
  return {
    front: regionStatesForMuscles(musclesOnView(muscleIds, 'front'), recovering, justTrained),
    back: regionStatesForMuscles(musclesOnView(muscleIds, 'back'), recovering, justTrained),
  };
}

/** Lit regions for `BodyFigure`: one entry per region, `intensity` indexing the colour palette (1-based). */
export type BodyDataItem = { slug: MuscleRegion; intensity: number };

/**
 * Region states as `BodyFigure` data for the recovery palette (`getRecoveryPalette`): just trained
 * 1 (hot), recovering 2 (warm), ready 3 (ready green). Regions absent from `states` aren't in the
 * data, so they keep the diagram's neutral untrained fill.
 */
export function regionStatesToBodyData(states: RegionStates): BodyDataItem[] {
  const intensity: Record<RegionState, number> = { justTrained: 1, recovering: 2, ready: 3 };
  return (Object.entries(states) as [MuscleRegion, RegionState][]).map(([slug, state]) => ({
    slug,
    intensity: intensity[state],
  }));
}

/**
 * The regions a template is mostly about: regions trained by two or more of its exercises. A
 * region only one accessory exercise trains (plank on leg day) is left out so it can't widen the
 * muscle art crop. When no region repeats, every region counts.
 */
export function focusRegions(exerciseMuscles: readonly (readonly MuscleId[])[]): MuscleRegion[] {
  const counts = new Map<MuscleRegion, number>();
  for (const muscles of exerciseMuscles) {
    for (const slug of new Set(muscles.map((id) => MUSCLE_ID_TO_DIAGRAM_REGION[id]))) {
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }
  const repeated = [...counts].filter(([, n]) => n >= 2).map(([slug]) => slug);
  return repeated.length > 0 ? repeated : [...counts.keys()];
}
