import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createRng } from '../../src/core/rng';
import { createPool, scrollObstacles } from '../../src/game/obstacles';
import type { Obstacle } from '../../src/game/obstacles';
import { applySpawnPlan, spawnObstacle } from '../../src/game/spawner';

type Op =
  | { kind: 'step' }
  | { kind: 'spawn' }
  | { kind: 'plan'; count: number };

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.constant<Op>({ kind: 'step' }),
  fc.constant<Op>({ kind: 'spawn' }),
  fc.record({ kind: fc.constant('plan' as const), count: fc.integer({ min: 0, max: 1000 }) }),
);

const snapshot = (items: readonly Obstacle[]): Obstacle[] => items.map((o) => ({ ...o }));

describe('Property 12: Conservation du pool et robustesse au pool plein', () => {
  /**
   * **Validates: Requirements 4.7, 4.8, 4.9, 4.11**
   */
  it('taille constante, aucune exception, spawn refusé sans effet, liste vide sans activation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.integer({ min: 1, max: 64 }),
        fc.array(opArb, { minLength: 0, maxLength: 40 }),
        (seed, poolSize, ops) => {
          const rng = createRng(seed);
          const pool = createPool(poolSize);
          const itemsRef = pool.items;

          for (const op of ops) {
            const before = snapshot(pool.items);
            const activeBefore = before.filter((o) => o.active).length;
            const stateBefore = rng.getState();

            if (op.kind === 'step') {
              scrollObstacles(pool);
            } else if (op.kind === 'spawn') {
              const res = spawnObstacle(pool, rng);
              if (activeBefore === poolSize) {
                // Pool plein : refus, aucun obstacle ni RNG modifié.
                expect(res).toBeUndefined();
                expect(snapshot(pool.items)).toEqual(before);
                expect(rng.getState()).toBe(stateBefore);
              } else {
                expect(res).toBeDefined();
              }
            } else {
              const requests = Array.from({ length: op.count }, (_, i) => ({ atDistance: i }));
              const activated = applySpawnPlan(pool, rng, requests);
              const activeAfter = pool.items.filter((o) => o.active).length;
              expect(activated).toBe(Math.min(op.count, poolSize - activeBefore));
              expect(activeAfter).toBe(activeBefore + activated);
              if (op.count === 0) {
                expect(activated).toBe(0);
                expect(snapshot(pool.items)).toEqual(before);
              }
            }

            expect(pool.items).toBe(itemsRef);
            expect(pool.items.length).toBe(poolSize);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
