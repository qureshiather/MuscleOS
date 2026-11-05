import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CATALOG_SEED } from '@/data/catalogSeed';
import {
  DEMO_BASE_URL,
  DEMO_CACHE_MAX_AGE_MS,
  demoCacheFileName,
  demoCacheIsFresh,
  exerciseDemoPosterUrl,
  exerciseDemoVideoUrl,
  exercisePageUrl,
} from './exerciseDemo';

describe('exercisePageUrl', () => {
  it('links every published catalog exercise to its website page', () => {
    expect(exercisePageUrl({ id: 'squat', isPublished: true })).toBe('https://muscleos.app/exercises/squat');
    expect(exercisePageUrl({ id: 'arnold-press' })).toBe('https://muscleos.app/exercises/arnold-press');
  });

  it('has no page for custom exercises or unpublished catalog rows', () => {
    expect(exercisePageUrl({ id: 'custom_abc123' })).toBeUndefined();
    expect(exercisePageUrl({ id: 'rowing-machine', isPublished: false })).toBeUndefined();
  });
});

describe('exerciseDemoPosterUrl', () => {
  it('points at the themed poster next to the clip', () => {
    expect(exerciseDemoPosterUrl({ id: 'squat' }, 'dark')).toBe(`${DEMO_BASE_URL}/squat-dark.webp`);
    expect(exerciseDemoPosterUrl({ id: 'squat' }, 'light')).toBe(`${DEMO_BASE_URL}/squat-light.webp`);
  });

  it('has no poster for custom exercises or unpublished catalog rows', () => {
    expect(exerciseDemoPosterUrl({ id: 'custom_abc123' }, 'dark')).toBeUndefined();
    expect(exerciseDemoPosterUrl({ id: 'rowing-machine', isPublished: false }, 'dark')).toBeUndefined();
  });
});

describe('exerciseDemoVideoUrl', () => {
  it('points at the themed clip in the Blob store', () => {
    expect(exerciseDemoVideoUrl({ id: 'arnold-press' }, 'dark')).toBe(`${DEMO_BASE_URL}/arnold-press-dark.mp4`);
    expect(exerciseDemoVideoUrl({ id: 'arnold-press' }, 'light')).toBe(`${DEMO_BASE_URL}/arnold-press-light.mp4`);
  });

  it('has no demo for custom exercises or unpublished catalog rows', () => {
    expect(exerciseDemoVideoUrl({ id: 'custom_abc123' }, 'dark')).toBeUndefined();
    expect(exerciseDemoVideoUrl({ id: 'rowing-machine', isPublished: false }, 'dark')).toBeUndefined();
  });

  it('uses the same Blob folder as the website', () => {
    const store = JSON.parse(
      readFileSync(resolve(__dirname, '../../../landing/app/data/exerciseDemoStore.json'), 'utf8')
    ) as { baseUrl: string };
    expect(DEMO_BASE_URL).toBe(store.baseUrl);
  });

  it('every published exercise in the bundled seed has a rendered demo', () => {
    const demoIds = new Set(
      JSON.parse(readFileSync(resolve(__dirname, '../../../landing/app/data/exerciseDemos.json'), 'utf8')) as string[]
    );
    const missing = CATALOG_SEED.filter((e) => exerciseDemoVideoUrl(e, 'dark') && !demoIds.has(e.id)).map((e) => e.id);
    expect(missing).toEqual([]);
  });
});

describe('demo cache', () => {
  it('names the cached file after the clip', () => {
    expect(demoCacheFileName(`${DEMO_BASE_URL}/arnold-press-dark.mp4`)).toBe('arnold-press-dark.mp4');
  });

  it('uses a cached clip for 30 days, then refreshes it', () => {
    const now = 1_800_000_000_000;
    expect(DEMO_CACHE_MAX_AGE_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(demoCacheIsFresh(now - 1000, now)).toBe(true);
    expect(demoCacheIsFresh(now - DEMO_CACHE_MAX_AGE_MS + 1, now)).toBe(true);
    expect(demoCacheIsFresh(now - DEMO_CACHE_MAX_AGE_MS, now)).toBe(false);
    expect(demoCacheIsFresh(undefined, now)).toBe(false);
  });
});
