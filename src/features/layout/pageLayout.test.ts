import { describe, expect, it } from 'vitest';
import { calculateLayout, inchesToMm, mmToInches } from './pageLayout';
import { DEFAULT_PAGE, DEFAULT_TEMPLATE } from '../../types';

const template = { ...DEFAULT_TEMPLATE, code: { ...DEFAULT_TEMPLATE.code, field: 'Asset ID' } };

describe('page layout', () => {
  it('converts millimeters and inches', () => {
    expect(mmToInches(25.4)).toBe(1);
    expect(inchesToMm(1)).toBe(25.4);
  });

  it('returns row-major label origins and page count', () => {
    const result = calculateLayout(template, DEFAULT_PAGE, 25);
    expect(result.positions[0]).toEqual({ xMm: 10, yMm: 10 });
    expect(result.positions[1]!.xMm).toBe(73);
    expect(result.positions[result.columns]!.yMm).toBe(43);
    expect(result.positions.at(-1)!.xMm).toBe(10 + (result.columns - 1) * 63);
    expect(result.positions.at(-1)!.yMm).toBe(10 + (result.rows - 1) * 33);
    expect(result.pages).toBe(Math.ceil(25 / result.labelsPerPage));
  });

  it('handles exact fit, uneven margins, empty datasets, and common page dimensions', () => {
    const exact = calculateLayout(template, { ...DEFAULT_PAGE, widthMm: 60, heightMm: 30, marginLeftMm: 0, marginRightMm: 0, marginTopMm: 0, marginBottomMm: 0, gapXMm: 0, gapYMm: 0 }, 0);
    expect(exact.pages).toBe(0);
    expect(exact.positions).toEqual([{ xMm: 0, yMm: 0 }]);
    const uneven = calculateLayout(template, { ...DEFAULT_PAGE, marginLeftMm: 8, marginTopMm: 6 }, 1);
    expect(uneven.positions[0]).toEqual({ xMm: 8, yMm: 6 });
    for (const dimensions of [[210, 297], [216, 279], [148, 210]]) {
      const [widthMm, heightMm] = dimensions;
      expect(calculateLayout(template, { ...DEFAULT_PAGE, widthMm: widthMm!, heightMm: heightMm! }, 1).labelsPerPage).toBeGreaterThan(0);
    }
  });

  it.each([
    [{ ...DEFAULT_PAGE, widthMm: Number.NaN }, 1, /Page width/],
    [DEFAULT_PAGE, 20_001, /20,000/],
    [{ ...DEFAULT_PAGE, marginLeftMm: -1 }, 1, /Left margin/],
    [{ ...DEFAULT_PAGE, gapXMm: Number.POSITIVE_INFINITY }, 1, /Horizontal gap/],
    [{ ...DEFAULT_PAGE, gapYMm: -1 }, 1, /Vertical gap/],
    [DEFAULT_PAGE, -1, /Record count/],
    [DEFAULT_PAGE, 1.5, /Record count/],
    [DEFAULT_PAGE, Number.POSITIVE_INFINITY, /Record count/],
    [{ ...DEFAULT_PAGE, widthMm: 50, marginLeftMm: 20, marginRightMm: 20 }, 1, /does not fit/],
  ] as const)('rejects invalid layout inputs', (page, count, message) => {
    expect(() => calculateLayout(template, page, count)).toThrow(message);
  });
});
