/** Muscle group IDs for anatomy mapping and recovery */
export type MuscleId =
  | 'chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'traps'
  | 'lats'
  | 'rhomboids'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'lower_back'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves';

export interface MuscleGroup {
  id: MuscleId;
  name: string;
  /** SVG path or region key for body diagram */
  region?: 'upper_front' | 'upper_back' | 'lower_front' | 'lower_back' | 'arms';
}

export const MUSCLE_GROUPS: Record<MuscleId, MuscleGroup> = {
  chest: { id: 'chest', name: 'Chest', region: 'upper_front' },
  front_delts: { id: 'front_delts', name: 'Front Delts', region: 'upper_front' },
  side_delts: { id: 'side_delts', name: 'Side Delts', region: 'upper_front' },
  rear_delts: { id: 'rear_delts', name: 'Rear Delts', region: 'upper_back' },
  traps: { id: 'traps', name: 'Traps', region: 'upper_back' },
  lats: { id: 'lats', name: 'Lats', region: 'upper_back' },
  rhomboids: { id: 'rhomboids', name: 'Rhomboids', region: 'upper_back' },
  biceps: { id: 'biceps', name: 'Biceps', region: 'arms' },
  triceps: { id: 'triceps', name: 'Triceps', region: 'arms' },
  forearms: { id: 'forearms', name: 'Forearms', region: 'arms' },
  abs: { id: 'abs', name: 'Abs', region: 'upper_front' },
  obliques: { id: 'obliques', name: 'Obliques', region: 'upper_front' },
  lower_back: { id: 'lower_back', name: 'Lower Back', region: 'upper_back' },
  quads: { id: 'quads', name: 'Quads', region: 'lower_front' },
  hamstrings: { id: 'hamstrings', name: 'Hamstrings', region: 'lower_back' },
  glutes: { id: 'glutes', name: 'Glutes', region: 'lower_back' },
  calves: { id: 'calves', name: 'Calves', region: 'lower_back' },
};
