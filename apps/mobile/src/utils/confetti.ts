/**
 * Timing for the finish-screen confetti (`WorkoutConfetti`).
 * Spec: docs/features/workout-logging.md#finishing
 *
 * Pieces fall in staggered waves so the celebration lasts several seconds rather than one quick
 * burst. Everything here is pure; the component only animates what it's given.
 */

/** Total pieces across all waves. */
export const CONFETTI_PIECES = 72;
/** Waves of pieces, each released `CONFETTI_WAVE_GAP_MS` after the last. */
export const CONFETTI_WAVES = 3;
export const CONFETTI_WAVE_GAP_MS = 700;
/** Random extra delay within a wave, so a wave doesn't drop as one row. */
export const CONFETTI_JITTER_MS = 400;
/** How long one piece takes to fall, min and max. */
export const CONFETTI_FALL_MIN_MS = 2800;
export const CONFETTI_FALL_MAX_MS = 4000;

export type ConfettiPiece = {
  /** Horizontal start, 0–1 of the screen width. */
  x: number;
  delay: number;
  duration: number;
  size: number;
  /** Index into the confetti colour list. */
  colorIndex: number;
  /** Sideways drift in px over the fall. */
  drift: number;
  /** Total rotation in degrees (signed). */
  spin: number;
};

/** Deal pieces round-robin into waves. `random` returns [0, 1) and is injectable for tests. */
export function makeConfettiPieces(
  count: number = CONFETTI_PIECES,
  random: () => number = Math.random
): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => {
    const wave = i % CONFETTI_WAVES;
    return {
      x: random(),
      delay: wave * CONFETTI_WAVE_GAP_MS + Math.floor(random() * CONFETTI_JITTER_MS),
      duration:
        CONFETTI_FALL_MIN_MS + Math.floor(random() * (CONFETTI_FALL_MAX_MS - CONFETTI_FALL_MIN_MS)),
      size: 6 + Math.floor(random() * 8),
      colorIndex: i,
      drift: -60 + random() * 120,
      spin: (random() > 0.5 ? 1 : -1) * (180 + random() * 360),
    };
  });
}

/** When the last piece has finished falling. */
export function confettiTotalMs(pieces: readonly ConfettiPiece[]): number {
  return pieces.reduce((max, p) => Math.max(max, p.delay + p.duration), 0);
}
