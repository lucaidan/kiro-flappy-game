import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createLoop } from '../../src/core/loop';

const MAX_FRAME_MS = 250;

// Δt valides, négatifs, NaN, infinis ou supérieurs à 250 ms.
const deltaArb = fc.oneof(
  fc.double({ min: 0, max: 250, noNaN: true }),
  fc.double({ min: 250, max: 1e6, noNaN: true }),
  fc.double({ min: -1e6, max: 0, noNaN: true }),
  fc.constantFrom(NaN, Infinity, -Infinity),
);

describe('Boucle - Property 1: comptage des pas et alpha', () => {
  it('exécute floor((reste + Δt_effectif) / pas) mises à jour, alpha dans [0, 1[, invalide = reste inchangé', () => {
    // **Validates: Requirements 1.2, 1.3, 1.4, 1.5**
    fc.assert(
      fc.property(
        fc.double({ min: 0.005, max: 0.1, noNaN: true }),
        fc.array(deltaArb, { maxLength: 100 }),
        (fixedDt, deltas) => {
          let calls = 0;
          const loop = createLoop({ fixedDtSeconds: fixedDt, maxFrameMs: MAX_FRAME_MS }, () => {
            calls++;
          });
          const step = loop.stepMs;
          let rest = 0;

          for (const delta of deltas) {
            const valid = Number.isFinite(delta) && delta > 0;
            const effective = valid ? Math.min(delta, MAX_FRAME_MS) : 0;
            const expected = Math.floor((rest + effective) / step);
            const before = calls;
            const alpha = loop.advance(delta);

            expect(calls - before).toBe(expected);
            expect(alpha).toBeGreaterThanOrEqual(0);
            expect(alpha).toBeLessThan(1);

            if (!valid) {
              // Valeur invalide : reste inchangé, donc alpha inchangé.
              expect(alpha).toBeCloseTo(rest / step, 12);
              expect(calls).toBe(before);
            } else {
              rest = Math.min(Math.max(rest + effective - expected * step, 0), step);
              if (rest >= step) rest = 0;
              expect(alpha).toBeCloseTo(rest / step, 9);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Boucle - Property 2: indépendance au découpage du temps', () => {
  const countSteps = (fixedDt: number, deltas: number[]): number => {
    let calls = 0;
    const loop = createLoop({ fixedDtSeconds: fixedDt, maxFrameMs: MAX_FRAME_MS }, () => {
      calls++;
    });
    for (const d of deltas) loop.advance(d);
    return calls;
  };

  it('deux découpages de même somme (Δt ≤ 250 ms) diffèrent d’au plus une mise à jour', () => {
    // **Validates: Requirements 1.7**
    fc.assert(
      fc.property(
        fc.double({ min: 0.005, max: 0.1, noNaN: true }),
        fc.array(fc.double({ min: 0.001, max: 125, noNaN: true }), { minLength: 1, maxLength: 60 }),
        fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 60, maxLength: 60 }),
        (fixedDt, deltas, parts) => {
          // Redécoupage A : chaque Δt divisé en n parts égales.
          const split = deltas.flatMap((d, i) => Array<number>(parts[i] ?? 1).fill(d / (parts[i] ?? 1)));
          // Redécoupage B : fusion gloutonne de Δt consécutifs tant que la somme reste ≤ 250 ms.
          const merged: number[] = [];
          let acc = 0;
          for (const d of deltas) {
            if (acc + d <= MAX_FRAME_MS) {
              acc += d;
            } else {
              merged.push(acc);
              acc = d;
            }
          }
          merged.push(acc);

          const base = countSteps(fixedDt, deltas);
          expect(Math.abs(countSteps(fixedDt, split) - base)).toBeLessThanOrEqual(1);
          expect(Math.abs(countSteps(fixedDt, merged) - base)).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 200 },
    );
  });
});
