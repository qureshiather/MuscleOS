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
