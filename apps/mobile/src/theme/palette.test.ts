import { describe, expect, it } from 'vitest';
import { buildThemeColors, darkThemeColors, lightThemeColors, paletteConfig } from './palette';

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
    expect(colors.subtleDivider).toBe('rgba(255,255,255,0.08)');
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
