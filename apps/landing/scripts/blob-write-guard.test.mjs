import { describe, expect, it } from 'vitest';
import { WRITE_GUARD, allowedWrites, writeGuardError } from './blob-write-guard.mjs';

describe('blob write guard', () => {
  it('lets small batches through without a flag', () => {
    expect(writeGuardError(WRITE_GUARD, 0)).toBeNull();
    expect(writeGuardError(4, 0)).toBeNull();
  });

  it('refuses larger batches unless --allow-writes covers them', () => {
    expect(writeGuardError(WRITE_GUARD + 1, 0)).toMatch(/--allow-writes=201/);
    expect(writeGuardError(640, 600)).not.toBeNull();
    expect(writeGuardError(640, 640)).toBeNull();
  });

  it('reads --allow-writes=N, ignoring anything that is not a positive integer', () => {
    expect(allowedWrites(['squat', '--allow-writes=640'])).toBe(640);
    expect(allowedWrites(['squat'])).toBe(0);
    expect(allowedWrites(['--allow-writes=lots'])).toBe(0);
    expect(allowedWrites(['--allow-writes=-5'])).toBe(0);
  });
});
