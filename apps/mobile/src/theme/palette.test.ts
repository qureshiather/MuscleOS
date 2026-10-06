import { describe, expect, it } from 'vitest';
import { blendOver, buildThemeColors, darkThemeColors, lightThemeColors, paletteConfig } from './palette';

const ON_FILL_TOKENS = ['primaryOn', 'successOn', 'dangerOn'] as const;
const DERIVED_ON_TOKENS = ['primaryOnMuted', 'primaryOnSurface'] as const;
const SHADOW_TOKENS = ['shadow', 'shadowCool'] as const;

describe.each([
  ['dark', darkThemeColors],
  ['light', lightThemeColors],
] as const)('%s theme semantic tokens', (_mode, colors) => {
  it('defines foreground-on-fill tokens as white (matches the pre-token #fff)', () => {
    for (const key of ON_FILL_TOKENS) {
      expect(colors[key]).toBe('#FFFFFF');
    }
  });

  it('derives translucent on-primary tokens from primaryOn', () => {
    expect(colors.primaryOnMuted).toBe('rgba(255, 255, 255, 0.88)');
    expect(colors.primaryOnSurface).toBe('rgba(255, 255, 255, 0.2)');
    for (const key of DERIVED_ON_TOKENS) {
      expect(colors[key]).toMatch(/^rgba\(/);
    }
  });

  it('defines shadow and divider tokens', () => {
    for (const key of SHADOW_TOKENS) {
      expect(colors[key]).toMatch(/^#[0-9A-F]{6}$/);
    }
    expect(colors.shadow).toBe('#000000');
    expect(colors.shadowCool).toBe('#0F172A');
  });

  it('subtle divider is a faint line that contrasts with each background', () => {
    expect(darkThemeColors.subtleDivider).toBe('rgba(255,255,255,0.08)');
    // Light mode used the dark-mode white line, which was invisible on a light background.
    expect(lightThemeColors.subtleDivider).toBe('rgba(15,23,42,0.08)');
  });
});

describe('buildThemeColors', () => {
  it('exposes every base palette key in both modes', () => {
    for (const mode of ['dark', 'light'] as const) {
      const built = buildThemeColors(mode);
      for (const key of Object.keys(paletteConfig[mode])) {
        expect(built).toHaveProperty(key);
      }
    }
  });
});

describe('blendOver', () => {
  it('returns the base at alpha 0 and the color at alpha 1', () => {
    expect(blendOver('#3ED68C', 0, '#1C1F2A')).toBe('#1C1F2A');
    expect(blendOver('#3ED68C', 1, '#1C1F2A')).toBe('#3ED68C');
  });

  it('mixes each channel and rounds to an opaque hex', () => {
    expect(blendOver('#FFFFFF', 0.5, '#000000')).toBe('#808080');
    expect(blendOver('#FF0000', 0.25, '#0000FF')).toBe('#4000BF');
  });

  it('accepts shorthand hex and clamps alpha', () => {
    expect(blendOver('#fff', 2, '#000')).toBe('#FFFFFF');
    expect(blendOver('#fff', -1, '#000')).toBe('#000000');
  });
});
