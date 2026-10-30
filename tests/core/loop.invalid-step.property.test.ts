import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createLoop } from '../../src/core/loop';

// Feature: flappy-logic-engine-m1, Property 3: Rejet d'un pas fixe invalide
describe('Property 3: Rejet d\'un pas fixe invalide', () => {
  it('lève une erreur et n\'exécute aucune mise à jour pour un pas ≤ 0, NaN ou infini', () => {
    /** **Validates: Requirements 1.8** */
    const invalidStep = fc.oneof(
      fc.double({ max: 0, noNaN: true }),
      fc.constantFrom(NaN, Infinity, -Infinity, 0, -0),
    );
    fc.assert(
      fc.property(invalidStep, (step) => {
        let calls = 0;
        expect(() =>
          createLoop({ fixedDtSeconds: step, maxFrameMs: 250 }, () => {
            calls++;
          }),
        ).toThrow('Pas_Fixe invalide');
        expect(calls).toBe(0);
      }),
      { numRuns: 100 },
    );
  });
});
