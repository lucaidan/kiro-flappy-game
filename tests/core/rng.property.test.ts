import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createRng } from '../../src/core/rng';

const seedArb = fc.integer({ min: 0, max: 0xffffffff });

type Op =
  | { kind: 'next' }
  | { kind: 'float'; min: number; max: number }
  | { kind: 'int'; min: number; max: number };

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.constant<Op>({ kind: 'next' }),
  fc
    .tuple(
      fc.double({ min: -1e6, max: 1e6, noNaN: true }),
      fc.double({ min: 1e-3, max: 1e6, noNaN: true }),
    )
    .map(([min, span]): Op => ({ kind: 'float', min, max: min + span }))
    .filter((o) => o.kind === 'float' && o.min < o.max),
  fc
    .tuple(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: 0, max: 2000 }))
    .map(([min, span]): Op => ({ kind: 'int', min, max: min + span })),
);

describe('RNG - Property 4: déterminisme et bornes', () => {
  it('suites identiques pour une même graine, résultats dans les bornes, initialSeed inchangée', () => {
    // **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.7**
    fc.assert(
      fc.property(seedArb, fc.array(opArb, { maxLength: 100 }), (seed, ops) => {
        const a = createRng(seed);
        const b = createRng(seed);
        for (const op of ops) {
          let va: number;
          let vb: number;
          if (op.kind === 'next') {
            va = a.next();
            vb = b.next();
            expect(va).toBeGreaterThanOrEqual(0);
            expect(va).toBeLessThan(1);
          } else if (op.kind === 'float') {
            va = a.float(op.min, op.max);
            vb = b.float(op.min, op.max);
            expect(va).toBeGreaterThanOrEqual(op.min);
            // Float arithmetic may round up to max on extreme spans; allow <= max.
            expect(va).toBeLessThanOrEqual(op.max);
          } else {
            va = a.int(op.min, op.max);
            vb = b.int(op.min, op.max);
            expect(Number.isInteger(va)).toBe(true);
            expect(va).toBeGreaterThanOrEqual(op.min);
            expect(va).toBeLessThanOrEqual(op.max);
          }
          expect(va).toBe(vb);
          expect(a.initialSeed).toBe(seed);
        }
        expect(a.getState()).toBe(b.getState());
      }),
      { numRuns: 200 },
    );
  });

  it('int(n, n) retourne n', () => {
    // **Validates: Requirements 2.4**
    fc.assert(
      fc.property(seedArb, fc.integer({ min: -1000, max: 1000 }), (seed, n) => {
        expect(createRng(seed).int(n, n)).toBe(n);
      }),
      { numRuns: 100 },
    );
  });
});

const nonFiniteArb = fc.constantFrom(NaN, Infinity, -Infinity);
const anyFiniteArb = fc.double({ min: -1e6, max: 1e6, noNaN: true });

// Couples invalides : min > max, ou au moins une borne non finie.
const invalidBoundsArb: fc.Arbitrary<[number, number]> = fc.oneof(
  fc
    .tuple(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: 1, max: 2000 }))
    .map(([max, gap]): [number, number] => [max + gap, max]),
  fc.tuple(nonFiniteArb, anyFiniteArb),
  fc.tuple(anyFiniteArb, nonFiniteArb),
  fc.tuple(nonFiniteArb, nonFiniteArb),
);

describe('RNG - Property 5: bornes invalides', () => {
  it('lève une erreur et laisse la suite de valeurs identique à un RNG sans appel invalide', () => {
    // **Validates: Requirements 2.5**
    fc.assert(
      fc.property(
        seedArb,
        fc.array(fc.tuple(invalidBoundsArb, fc.constantFrom('float', 'int')), {
          minLength: 1,
          maxLength: 10,
        }),
        fc.integer({ min: 1, max: 50 }),
        (seed, invalidCalls, n) => {
          const touched = createRng(seed);
          const reference = createRng(seed);

          for (const [[min, max], kind] of invalidCalls) {
            expect(() => (kind === 'float' ? touched.float(min, max) : touched.int(min, max))).toThrow();
            expect(touched.getState()).toBe(reference.getState());
          }

          for (let i = 0; i < n; i++) {
            expect(touched.next()).toBe(reference.next());
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
