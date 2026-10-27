import { describe, expect, it } from 'vitest';
import {
  computeDenseRowMetrics,
  DENSE_ROW_CHROME,
  DENSE_ROW_COL_GAP,
  type DenseRowMetrics,
} from './denseRowLayout';

const rowWidth = (m: DenseRowMetrics) =>
  m.setCol + m.prevMin + 2 * m.inputMin + m.doneBtn + 4 * DENSE_ROW_COL_GAP + DENSE_ROW_CHROME;

describe('computeDenseRowMetrics', () => {
  it('uses the base columns at default text on a regular phone', () => {
    expect(computeDenseRowMetrics({ width: 393, fontScale: 1 })).toEqual({
      rowMin: 50,
      inputMinHeight: 42,
      setCol: 34,
      prevMin: 72,
      inputMin: 60,
      doneBtn: 42,
    });
  });

  it('starts from narrower columns below 360pt', () => {
    const m = computeDenseRowMetrics({ width: 320, fontScale: 1 });
    expect(m.setCol).toBe(30);
    expect(m.prevMin).toBe(60);
    expect(m.inputMin).toBe(52);
  });

  it('grows columns with system text when the screen has room', () => {
    const m = computeDenseRowMetrics({ width: 440, fontScale: 1.3 });
    expect(m.inputMin).toBe(78);
    expect(m.doneBtn).toBe(55);
    expect(rowWidth(m)).toBeLessThanOrEqual(440);
  });

  it('caps the text scale at 1.5x', () => {
    expect(computeDenseRowMetrics({ width: 1000, fontScale: 3 })).toEqual(
      computeDenseRowMetrics({ width: 1000, fontScale: 1.5 })
    );
  });

  it.each([
    [320, 1.5],
    [375, 1.35],
    [375, 1.5],
    [390, 1.5],
    [402, 1.5],
  ])('fits the row inside a %ipt screen at %fx text', (width, fontScale) => {
    expect(rowWidth(computeDenseRowMetrics({ width, fontScale }))).toBeLessThanOrEqual(width);
  });

  it('keeps row heights scaled even when widths shrink to fit', () => {
    const m = computeDenseRowMetrics({ width: 375, fontScale: 1.5 });
    expect(m.rowMin).toBe(75);
    expect(m.inputMinHeight).toBe(63);
  });

  it('never shrinks a column below its narrow-phone floor', () => {
    const m = computeDenseRowMetrics({ width: 200, fontScale: 1.5 });
    expect(m).toMatchObject({ setCol: 30, prevMin: 60, inputMin: 52, doneBtn: 42 });
  });
});
