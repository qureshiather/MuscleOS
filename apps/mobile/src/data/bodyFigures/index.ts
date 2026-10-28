import { femaleBack } from './femaleBack';
import { femaleFront } from './femaleFront';
import { maleBack } from './maleBack';
import { maleFront } from './maleFront';
import type { Figure, FigureGender, FigureSide } from './types';

export type { Figure, FigureDetail, FigureGender, FigurePart, FigurePartId, FigureSide, MuscleRegion } from './types';

export const BODY_FIGURES: Record<FigureGender, Record<FigureSide, Figure>> = {
  male: { front: maleFront, back: maleBack },
  female: { front: femaleFront, back: femaleBack },
};
