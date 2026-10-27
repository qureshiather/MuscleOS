/**
 * Pure sizing helpers for modals and sheets. Kept free of react-native imports so the
 * rules are unit-testable.
 */

/**
 * Minimum height for a scrolling region inside a height-capped card, given the card's
 * cap and the measured height of everything else in it. The region keeps `preferred`
 * when there's room, and gives it up first when there isn't, so the card's actions
 * never get pushed past its bottom edge.
 */
export function scrollRegionFloor({
  maxHeight,
  otherContentHeight,
  preferred,
}: {
  maxHeight: number;
  otherContentHeight: number;
  preferred: number;
}): number {
  return Math.max(0, Math.min(preferred, maxHeight - otherContentHeight));
}
