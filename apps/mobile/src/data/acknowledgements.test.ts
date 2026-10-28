import { describe, expect, test } from 'vitest';
import pkg from '../../package.json';
import { ARTWORK_ACKNOWLEDGEMENTS, missingAcknowledgements, PACKAGE_ACKNOWLEDGEMENTS } from './acknowledgements';

/** docs/features/accounts-and-data.md#acknowledgements */
describe('acknowledgements', () => {
  test('every runtime dependency has a license notice', () => {
    expect(missingAcknowledgements(Object.keys(pkg.dependencies))).toEqual([]);
  });

  test('workspace packages are skipped; unknown packages are reported', () => {
    expect(missingAcknowledgements(['@muscleos/types', 'zustand', 'left-pad'])).toEqual(['left-pad']);
  });

  test('no duplicate entries, and every entry has a copyright line', () => {
    const names = PACKAGE_ACKNOWLEDGEMENTS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
    for (const a of [...PACKAGE_ACKNOWLEDGEMENTS, ...ARTWORK_ACKNOWLEDGEMENTS]) expect(a.copyright).toMatch(/^Copyright/);
  });

  test('the body diagram artwork is credited as artwork, not as a dependency we no longer have', () => {
    expect(pkg.dependencies).not.toHaveProperty('react-native-body-highlighter');
    expect(PACKAGE_ACKNOWLEDGEMENTS.map((a) => a.name)).not.toContain('react-native-body-highlighter');
    expect(ARTWORK_ACKNOWLEDGEMENTS.map((a) => a.copyright)).toContain('Copyright (c) 2022 ELABBASSI Hicham');
  });
});
