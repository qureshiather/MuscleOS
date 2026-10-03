import { describe, expect, it } from 'vitest';
import type { Exercise } from '@muscleos/types';
import {
  advanceWatermark,
  applyCatalogSeed,
  mergeCatalogById,
  reconcileCatalogCache,
} from './catalogMerge';

const bench: Exercise = {
  id: 'bench-press',
  name: 'Barbell Bench Press',
  muscles: ['chest'],
  equipment: ['barbell'],
  category: 'free_weight',
};

const row: Exercise = {
  id: 'barbell-row',
  name: 'Barbell Row',
  muscles: ['lats'],
  equipment: ['barbell'],
  category: 'free_weight',
};

describe('mergeCatalogById', () => {
  it('lets incoming rows replace matching ids', () => {
    const incoming = { ...bench, name: 'Bench Press' };
    expect(mergeCatalogById([bench, row], [incoming]).map((e) => e.name)).toEqual([
      'Bench Press',
      'Barbell Row',
    ]);
  });

  it('appends new ids after existing rows and keeps untouched rows', () => {
    const fresh: Exercise = { ...row, id: 'new-lift', name: 'New Lift' };
    expect(mergeCatalogById([bench, row], [fresh]).map((e) => e.id)).toEqual([
      'bench-press',
      'barbell-row',
      'new-lift',
    ]);
  });

  it('lets the later of two delta rows for the same id win', () => {
    const first = { ...bench, name: 'First' };
    const second = { ...bench, name: 'Second' };
    expect(mergeCatalogById([bench], [first, second]).map((e) => e.name)).toEqual(['Second']);
  });
});

describe('applyCatalogSeed', () => {
  it('applies seed names while keeping cached instructions when the seed row has none', () => {
    const cached = { ...bench, name: 'Cable rear delt row', instructions: 'Keep me' };
    const seed = { ...bench, name: 'Cable Rear Delt Row' };

    expect(applyCatalogSeed([seed], [cached])).toEqual([{ ...seed, instructions: 'Keep me' }]);
  });

  it('keeps cache-only rows that the seed does not include', () => {
    expect(applyCatalogSeed([bench], [bench, row]).map((e) => e.id)).toEqual([
      'bench-press',
      'barbell-row',
    ]);
  });

  it('sets seed instructions on a cached row that has none', () => {
    const seed = { ...bench, instructions: 'Seed copy' };
    expect(applyCatalogSeed([seed], [bench])[0].instructions).toBe('Seed copy');
  });

  it('lets seed instructions replace cached copy (the seed is the newer source)', () => {
    const seed = { ...bench, instructions: 'New copy' };
    const cached = { ...bench, instructions: 'Old copy' };
    expect(applyCatalogSeed([seed], [cached])[0].instructions).toBe('New copy');
  });

  it('seeds an empty cache with every seed row, instructions included', () => {
    const seed = [
      { ...bench, instructions: 'A' },
      { ...row, instructions: 'B' },
    ];
    expect(applyCatalogSeed(seed, [])).toEqual(seed);
  });
});

describe('reconcileCatalogCache', () => {
  const SEED_AT = '2026-10-02T00:00:00.000Z';
  const seed: Exercise[] = [{ ...bench, name: 'Bench Press (seed)', instructions: 'Seed copy' }];

  it('applies the seed to an empty cache and starts the watermark at the seed date', () => {
    const result = reconcileCatalogCache(
      { exercises: [], watermark: null, seedAppliedAt: null },
      seed,
      SEED_AT
    );
    expect(result.catalog).toEqual(seed);
    expect(result.catalog[0].instructions).toBe('Seed copy');
    expect(result.watermark).toBe(SEED_AT);
    expect(result.write).toEqual({ exercises: seed, watermark: SEED_AT, seedAppliedAt: SEED_AT });
  });

  it('applies the seed when the cache has rows but no seedAppliedAt', () => {
    const result = reconcileCatalogCache(
      { exercises: [bench], watermark: '2026-09-01T00:00:00.000Z', seedAppliedAt: null },
      seed,
      SEED_AT
    );
    expect(result.catalog[0].name).toBe('Bench Press (seed)');
    expect(result.write?.seedAppliedAt).toBe(SEED_AT);
  });

  it('applies the seed when the cache is marked applied but empty', () => {
    const result = reconcileCatalogCache(
      { exercises: [], watermark: SEED_AT, seedAppliedAt: SEED_AT },
      seed,
      SEED_AT
    );
    expect(result.catalog).toEqual(seed);
    expect(result.write).not.toBeNull();
  });

  it('applies a newer seed over an older cache: seed fields win, instructions set, cache-only ids kept', () => {
    const result = reconcileCatalogCache(
      {
        exercises: [bench, row],
        watermark: '2026-09-15T00:00:00.000Z',
        seedAppliedAt: '2026-09-01T00:00:00.000Z',
      },
      seed,
      SEED_AT
    );
    expect(result.catalog.map((e) => e.id)).toEqual(['bench-press', 'barbell-row']);
    expect(result.catalog[0]).toMatchObject({ name: 'Bench Press (seed)', instructions: 'Seed copy' });
    expect(result.watermark).toBe(SEED_AT);
  });

  it('never moves the watermark backwards when the cache is ahead of the seed', () => {
    const later = '2026-10-05T12:00:00.000Z';
    const result = reconcileCatalogCache(
      { exercises: [bench], watermark: later, seedAppliedAt: '2026-09-01T00:00:00.000Z' },
      seed,
      SEED_AT
    );
    expect(result.watermark).toBe(later);
    expect(result.write?.watermark).toBe(later);
  });

  it('uses the cache untouched (no write) when the seed is already applied', () => {
    const cached = { ...bench, instructions: 'Server copy' };
    const result = reconcileCatalogCache(
      { exercises: [cached], watermark: '2026-10-03T00:00:00.000Z', seedAppliedAt: SEED_AT },
      seed,
      SEED_AT
    );
    expect(result).toEqual({
      catalog: [cached],
      watermark: '2026-10-03T00:00:00.000Z',
      write: null,
    });
  });

  it('falls back to the seed date when an applied cache has no watermark', () => {
    const result = reconcileCatalogCache(
      { exercises: [bench], watermark: null, seedAppliedAt: SEED_AT },
      seed,
      SEED_AT
    );
    expect(result.watermark).toBe(SEED_AT);
    expect(result.write).toBeNull();
  });
});

describe('advanceWatermark', () => {
  it('advances to the latest updated_at in the delta', () => {
    expect(
      advanceWatermark(
        [
          { updated_at: '2026-10-03T00:00:00.000Z' },
          { updated_at: '2026-10-05T00:00:00.000Z' },
          { updated_at: '2026-10-04T00:00:00.000Z' },
        ],
        '2026-10-02T00:00:00.000Z'
      )
    ).toBe('2026-10-05T00:00:00.000Z');
  });

  it('keeps the watermark for an empty delta, missing timestamps, or older rows', () => {
    const wm = '2026-10-02T00:00:00.000Z';
    expect(advanceWatermark([], wm)).toBe(wm);
    expect(advanceWatermark([{}, { updated_at: null }], wm)).toBe(wm);
    expect(advanceWatermark([{ updated_at: '2026-09-01T00:00:00.000Z' }], wm)).toBe(wm);
  });
});
