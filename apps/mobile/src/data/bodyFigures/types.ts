/**
 * Body figure artwork for the muscle diagram and the template-card art. The path data comes from
 * react-native-body-highlighter 3.1.4 (MIT, Copyright (c) 2022 ELABBASSI Hicham, credited in
 * Acknowledgements). We own a copy so we can change the regions: the library's single `upper-back`
 * region is split here into `lats` (the large panel down the side of the back) and `upper-back`
 * (the shoulder-blade pieces).
 */

export type FigureGender = 'male' | 'female';
export type FigureSide = 'front' | 'back';

/** Regions a muscle id can light (see `MUSCLE_ID_TO_DIAGRAM_REGION`). */
export type MuscleRegion =
  | 'abs'
  | 'adductors'
  | 'biceps'
  | 'calves'
  | 'chest'
  | 'deltoids'
  | 'forearm'
  | 'gluteal'
  | 'hamstring'
  | 'lats'
  | 'lower-back'
  | 'neck'
  | 'obliques'
  | 'quadriceps'
  | 'tibialis'
  | 'trapezius'
  | 'triceps'
  | 'upper-back';

/** Parts no muscle lights: they stay in the neutral fill so the figure still reads as a person. */
export type FigureDetail = 'ankles' | 'feet' | 'hair' | 'hands' | 'head' | 'knees';

export type FigurePartId = MuscleRegion | FigureDetail;

export type FigurePart = { id: FigurePartId; paths: readonly string[] };

export type Figure = {
  /** [x, y, width, height] of the full figure in its SVG user space. */
  viewBox: readonly [number, number, number, number];
  /** Silhouette drawn behind the parts. */
  outline: string;
  /** In paint order. */
  parts: readonly FigurePart[];
};
