import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { contrastRatio, relativeLuminance } from '../../src/render/contrast';

const colorArb = fc.integer({ min: 0, max: 0xffffff });

// Feature: flappy-rendu-2-5d-m2, Property 20: Contraste
describe('Property 20: Contraste', () => {
  /**
   * **Validates: Requirements 11.2, 11.3**
   */
  it('le ratio est dans [1, 21], symétrique, et vaut 1 pour deux couleurs identiques', () => {
    fc.assert(
      fc.property(colorArb, colorArb, (a, b) => {
        const r = contrastRatio(a, b);
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(21 + 1e-9);
        expect(r).toBe(contrastRatio(b, a));
        expect(contrastRatio(a, a)).toBe(1);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 11.2, 11.3**
   */
  it('la luminance relative est dans [0, 1] et croissante au sens large par canal', () => {
    fc.assert(
      fc.property(
        colorArb,
        fc.constantFrom(0, 8, 16),
        fc.integer({ min: 0, max: 255 }),
        (color, shift, delta) => {
          const l = relativeLuminance(color);
          expect(l).toBeGreaterThanOrEqual(0);
          expect(l).toBeLessThanOrEqual(1 + 1e-9);
          const channel = (color >> shift) & 0xff;
          const raised = Math.min(255, channel + delta);
          const color2 = (color & ~(0xff << shift)) | (raised << shift);
          expect(relativeLuminance(color2)).toBeGreaterThanOrEqual(l);
        },
      ),
      { numRuns: 200 },
    );
  });
});
