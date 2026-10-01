import type { Slug } from 'react-native-body-highlighter';

export type FigureSide = 'front' | 'back';
export type FigureGender = 'male' | 'female';
/** [minX, minY, maxX, maxY] in the figure's SVG user space. */
type Bounds = readonly [number, number, number, number];
/** [x, y, width, height], ready for an SVG viewBox. */
export type ViewBox = readonly [number, number, number, number];

/**
 * Bounding boxes of each trackable region in react-native-body-highlighter 3.1.4's figure paths
 * (left + right + common), measured once from the path data. Regenerate if the library's assets
 * change. The male front and back share one canvas (back is offset by 724); the female figure
 * uses its own coordinates.
 */
const REGION_BOUNDS: Record<FigureGender, Record<FigureSide, Partial<Record<Slug, Bounds>>>> = {
  male: {
    front: {
      chest: [251, 316, 476, 438],
      obliques: [255, 417, 473, 658],
      abs: [300, 425, 423, 716],
      biceps: [181, 404, 547, 499],
      triceps: [200, 385, 528, 517],
      trapezius: [285, 279, 446, 312],
      deltoids: [193, 296, 543, 398],
      adductors: [274, 647, 454, 899],
      quadriceps: [240, 667, 487, 952],
      calves: [249, 1008, 479, 1232],
      forearm: [123, 499, 606, 686],
    },
    back: {
      trapezius: [1002, 296, 1164, 473],
      deltoids: [914, 309, 1253, 398],
      'upper-back': [955, 322, 1211, 585],
      triceps: [898, 382, 1269, 535],
      'lower-back': [979, 486, 1185, 639],
      forearm: [839, 518, 1328, 688],
      gluteal: [974, 614, 1194, 780],
      adductors: [1039, 782, 1128, 863],
      hamstring: [962, 741, 1205, 1008],
      calves: [970, 971, 1199, 1290],
    },
  },
  female: {
    front: {
      trapezius: [240, 271, 400, 302],
      deltoids: [167, 282, 474, 372],
      chest: [215, 319, 426, 434],
      biceps: [155, 383, 486, 477],
      triceps: [164, 433, 477, 494],
      obliques: [223, 413, 418, 617],
      abs: [256, 438, 386, 681],
      forearm: [73, 482, 568, 650],
      adductors: [223, 607, 418, 877],
      quadriceps: [194, 622, 447, 970],
      calves: [226, 1053, 417, 1291],
    },
    back: {
      trapezius: [1034, 278, 1251, 408],
      deltoids: [991, 283, 1294, 373],
      'upper-back': [1028, 315, 1258, 541],
      'lower-back': [1060, 507, 1225, 617],
      triceps: [976, 355, 1310, 492],
      forearm: [898, 486, 1387, 645],
      gluteal: [1011, 600, 1281, 792],
      adductors: [1094, 748, 1191, 1026],
      hamstring: [1016, 759, 1270, 1002],
      calves: [1049, 987, 1236, 1363],
    },
  },
};

/** Padding around the lit regions, as a fraction of their larger side. */
const CROP_PADDING = 0.12;
/** Smallest crop height in figure units (~a quarter of the body), so one small muscle isn't a blur. */
const MIN_CROP_HEIGHT = 360;
/** Crop used when nothing is lit: shoulders to waist, front. */
const DEFAULT_REGIONS: Slug[] = ['chest', 'deltoids', 'abs'];

function area([x0, y0, x1, y1]: Bounds): number {
  return (x1 - x0) * (y1 - y0);
}

/**
 * The side that shows more of the lit regions, by summed bounding-box area. Ties go to the front.
 */
export function pickFigureSide(regions: readonly Slug[], gender: FigureGender): FigureSide {
  const score = (side: FigureSide) =>
    regions.reduce((sum, slug) => {
      const b = REGION_BOUNDS[gender][side][slug];
      return b ? sum + area(b) : sum;
    }, 0);
  return score('back') > score('front') ? 'back' : 'front';
}

/**
 * A viewBox that zooms the figure onto the lit regions for a card's art area. The union of the
 * regions' boxes on the chosen side is padded, held to a minimum height, then widened or
 * heightened around its centre to match `aspect` (width / height) so it fills the art exactly.
 */
export function cropToRegions(
  regions: readonly Slug[],
  gender: FigureGender,
  aspect: number
): { side: FigureSide; viewBox: ViewBox } {
  const lit = regions.length > 0 ? regions : DEFAULT_REGIONS;
  const side = pickFigureSide(lit, gender);
  const boxes = lit.map((slug) => REGION_BOUNDS[gender][side][slug]).filter((b): b is Bounds => b != null);
  if (boxes.length === 0) return cropToRegions(DEFAULT_REGIONS, gender, aspect);
  const [x0, y0, x1, y1] = boxes.reduce<Bounds>(
    (u, b) => [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.max(u[2], b[2]), Math.max(u[3], b[3])],
    boxes[0]
  );
  const pad = Math.max(x1 - x0, y1 - y0) * CROP_PADDING;
  let w = x1 - x0 + pad * 2;
  let h = Math.max(y1 - y0 + pad * 2, MIN_CROP_HEIGHT);
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return { side, viewBox: [cx - w / 2, cy - h / 2, w, h] };
}
