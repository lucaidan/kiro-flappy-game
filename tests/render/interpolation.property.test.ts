import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { clampAlpha, interpolate } from '../../src/render/interpolation';

const posArb = fc.double({ min: -1e6, max: 1e6, noNaN: true });
// Alpha quelconque : hors [0, 1], infini, NaN inclus.
const alphaArb = fc.double({ noNaN: false });

describe('Property 29: Interpolation du rendu', () => {
  /**
   * **Validates: Requirements 13.3, 13.8**
   */
  it('clampAlpha vaut 0 pour NaN et borne sinon à [0, 1]', () => {
    fc.assert(
      fc.property(alphaArb, (alpha) => {
        const c = clampAlpha(alpha);
        if (Number.isNaN(alpha)) {
          expect(c).toBe(0);
        } else {
          // `===` : -0 et +0 sont équivalents pour l'interpolation.
          expect(c === Math.min(1, Math.max(0, alpha))).toBe(true);
        }
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 13.3, 13.8**
   */
  it('interpolate vaut prev + (cur - prev) × clampAlpha(alpha)', () => {
    fc.assert(
      fc.property(posArb, posArb, alphaArb, (prev, cur, alpha) => {
        const r = interpolate(prev, cur, alpha);
        expect(r).toBe(prev + (cur - prev) * clampAlpha(alpha));
        expect(Number.isFinite(r)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 13.3, 13.8**
   */
  it('alpha ≤ 0 ou NaN donne prev ; alpha ≥ 1 donne cur', () => {
    fc.assert(
      fc.property(posArb, posArb, (prev, cur) => {
        // `===` : -0 et +0 sont équivalents (prev = -0 donne +0 après l'addition).
        expect(interpolate(prev, cur, NaN) === prev).toBe(true);
        expect(interpolate(prev, cur, -Infinity) === prev).toBe(true);
        expect(interpolate(prev, cur, 0) === prev).toBe(true);
        expect(interpolate(prev, cur, 1) === prev + (cur - prev)).toBe(true);
        expect(interpolate(prev, cur, Infinity) === prev + (cur - prev)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
