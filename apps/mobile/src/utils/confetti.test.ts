import { describe, expect, it } from 'vitest';
import {
  CONFETTI_FALL_MAX_MS,
  CONFETTI_FALL_MIN_MS,
  CONFETTI_PIECES,
  CONFETTI_WAVE_GAP_MS,
  CONFETTI_WAVES,
  confettiTotalMs,
  makeConfettiPieces,
} from './confetti';

/** docs/features/workout-logging.md#finishing */
describe('makeConfettiPieces', () => {
  it('deals pieces into staggered waves', () => {
    const pieces = makeConfettiPieces(CONFETTI_PIECES, () => 0);
    expect(pieces).toHaveLength(CONFETTI_PIECES);
    const waveStarts = new Set(pieces.map((p) => p.delay));
    expect([...waveStarts].sort((a, b) => a - b)).toEqual(
      Array.from({ length: CONFETTI_WAVES }, (_, w) => w * CONFETTI_WAVE_GAP_MS)
    );
  });

  it('keeps each fall within its duration bounds', () => {
    for (const r of [0, 0.5, 0.999]) {
      for (const p of makeConfettiPieces(12, () => r)) {
        expect(p.duration).toBeGreaterThanOrEqual(CONFETTI_FALL_MIN_MS);
        expect(p.duration).toBeLessThan(CONFETTI_FALL_MAX_MS);
      }
    }
  });

  it('lasts about five seconds or more, not a quick burst', () => {
    // Even with every random roll at its minimum, the last wave lands after ~4 s.
    expect(confettiTotalMs(makeConfettiPieces(CONFETTI_PIECES, () => 0))).toBeGreaterThanOrEqual(4000);
    expect(confettiTotalMs(makeConfettiPieces(CONFETTI_PIECES, () => 0.999))).toBeGreaterThanOrEqual(5000);
  });
});
