import { describe, expect, it } from 'vitest';
import { BODY_FIGURES } from '@/data/bodyFigures';
import { cropToRegions, pickFigureSide, REGION_BOUNDS } from './bodyCrop';

/** Bounds of an SVG path from its end and control points: tight enough for these organic shapes. */
function pathBounds(d: string): [number, number, number, number] {
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let p = 0;
  let cmd = '';
  const xs: number[] = [];
  const ys: number[] = [];
  const skip = () => {
    while (p < d.length && /[\s,]/.test(d[p])) p++;
  };
  const num = () => {
    skip();
    const m = /^-?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/.exec(d.slice(p));
    if (!m) throw new Error(`Bad path at ${p}`);
    p += m[0].length;
    return Number.parseFloat(m[0]);
  };
  const flag = () => {
    skip();
    return d[p++];
  };
  const point = (px: number, py: number) => {
    xs.push(px);
    ys.push(py);
  };
  for (;;) {
    skip();
    if (p >= d.length) break;
    if (/[a-zA-Z]/.test(d[p])) cmd = d[p++];
    const c = cmd.toLowerCase();
    const rel = cmd === c;
    const ax = (v: number) => (rel ? x + v : v);
    const ay = (v: number) => (rel ? y + v : v);
    if (c === 'z') {
      x = startX;
      y = startY;
    } else if (c === 'm') {
      x = ax(num());
      y = ay(num());
      startX = x;
      startY = y;
      point(x, y);
      cmd = rel ? 'l' : 'L';
    } else if (c === 'l' || c === 't') {
      const [nx, ny] = [num(), num()];
      x = ax(nx);
      y = ay(ny);
      point(x, y);
    } else if (c === 'h') {
      x = ax(num());
      point(x, y);
    } else if (c === 'v') {
      y = ay(num());
      point(x, y);
    } else if (c === 'c' || c === 's' || c === 'q') {
      const v = Array.from({ length: c === 'c' ? 6 : 4 }, num);
      for (let i = 0; i < v.length - 2; i += 2) point(ax(v[i]), ay(v[i + 1]));
      x = ax(v[v.length - 2]);
      y = ay(v[v.length - 1]);
      point(x, y);
    } else if (c === 'a') {
      num();
      num();
      num();
      flag();
      flag();
      const [nx, ny] = [num(), num()];
      x = ax(nx);
      y = ay(ny);
      point(x, y);
    } else {
      throw new Error(`Unsupported command ${cmd}`);
    }
  }
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

describe('REGION_BOUNDS', () => {
  it('matches the figure paths, so the crop frames what is drawn', () => {
    for (const gender of ['male', 'female'] as const) {
      for (const side of ['front', 'back'] as const) {
        for (const [region, bounds] of Object.entries(REGION_BOUNDS[gender][side])) {
          const part = BODY_FIGURES[gender][side].parts.find((p) => p.id === region);
          if (!part) throw new Error(`${gender} ${side} has no ${region}`);
          const measured = part.paths
            .map(pathBounds)
            .reduce((u, b) => [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.max(u[2], b[2]), Math.max(u[3], b[3])]);
          measured.forEach((v, i) => {
            expect(Math.abs(v - bounds[i]), `${gender} ${side} ${region}[${i}]`).toBeLessThanOrEqual(1);
          });
        }
      }
    }
  });
});

describe('pickFigureSide', () => {
  it('shows the front for push muscles and the back for pull and posterior chain', () => {
    expect(pickFigureSide(['chest', 'deltoids', 'triceps'], 'male')).toBe('front');
    expect(pickFigureSide(['upper-back', 'biceps', 'trapezius', 'lower-back'], 'male')).toBe('back');
    expect(pickFigureSide(['quadriceps', 'hamstring', 'gluteal', 'calves'], 'male')).toBe('back');
    expect(pickFigureSide(['quadriceps'], 'female')).toBe('front');
    expect(pickFigureSide(['lats'], 'male')).toBe('back');
    expect(pickFigureSide(['upper-back'], 'female')).toBe('back');
  });
});

describe('cropToRegions', () => {
  it('matches the requested aspect and contains every lit region', () => {
    const { side, viewBox } = cropToRegions(['chest', 'deltoids', 'triceps'], 'male', 1.2);
    const [x, y, w, h] = viewBox;
    expect(side).toBe('front');
    expect(w / h).toBeCloseTo(1.2);
    // Deltoids span 193–543 × 296–398; chest reaches down to 438.
    expect(x).toBeLessThan(193);
    expect(x + w).toBeGreaterThan(543);
    expect(y).toBeLessThan(296);
    expect(y + h).toBeGreaterThan(438);
  });

  it('keeps a minimum height so a single small region is not over-zoomed', () => {
    const { viewBox } = cropToRegions(['trapezius'], 'male', 1);
    expect(viewBox[3]).toBeGreaterThanOrEqual(360);
  });

  it('falls back to a front torso crop when nothing is lit', () => {
    const { side, viewBox } = cropToRegions([], 'female', 1);
    expect(side).toBe('front');
    expect(viewBox[1]).toBeLessThan(434);
  });

  it('shows the shin on the front figure, low on the body', () => {
    for (const gender of ['male', 'female'] as const) {
      const { side, viewBox } = cropToRegions(['tibialis'], gender, 1);
      expect(side).toBe('front');
      expect(viewBox[1] + viewBox[3]).toBeGreaterThan(1200);
    }
  });

  it('crops the neck high on the figure', () => {
    const { viewBox } = cropToRegions(['neck'], 'male', 1);
    expect(viewBox[1]).toBeLessThan(240);
  });

  it('crops legs low on the figure', () => {
    const { viewBox } = cropToRegions(['quadriceps', 'hamstring', 'gluteal', 'calves'], 'male', 0.9);
    expect(viewBox[1]).toBeGreaterThan(400);
  });
});
