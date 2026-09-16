import { describe, expect, it } from 'vitest';
import { CATALOG_SEED } from '../data/catalogSeed';
import { toExerciseTitleCase } from './exerciseTitleCase';

describe('toExerciseTitleCase', () => {
  it('title-cases content words and keeps small words lowercase', () => {
    expect(toExerciseTitleCase('Cable rear delt row')).toBe('Cable Rear Delt Row');
    expect(toExerciseTitleCase('lat pulldown with pronated grip')).toBe(
      'Lat Pulldown with Pronated Grip'
    );
    expect(toExerciseTitleCase('behind the neck press')).toBe('Behind the Neck Press');
    expect(toExerciseTitleCase('clean and jerk')).toBe('Clean and Jerk');
  });

  it('capitalizes hyphenated segments and preserves short acronyms', () => {
    expect(toExerciseTitleCase('decline push-up')).toBe('Decline Push-Up');
    expect(toExerciseTitleCase('t-bar row')).toBe('T-Bar Row');
    expect(toExerciseTitleCase('l-sit')).toBe('L-Sit');
    expect(toExerciseTitleCase('ez curl')).toBe('EZ Curl');
    expect(toExerciseTitleCase('EZ Bar Lying Triceps Extension')).toBe(
      'EZ Bar Lying Triceps Extension'
    );
  });

  it('keeps every catalog name in title case', () => {
    const mismatches = CATALOG_SEED.filter((exercise) => {
      return toExerciseTitleCase(exercise.name) !== exercise.name;
    }).map((exercise) => `${exercise.id}: ${exercise.name}`);

    expect(mismatches).toEqual([]);
  });
});
