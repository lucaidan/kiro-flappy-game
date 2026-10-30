import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { GAME_CONFIG } from '../../src/config/game.config';
import { createRng } from '../../src/core/rng';
import { createPool, releaseAll } from '../../src/game/obstacles';
import { spawnObstacle } from '../../src/game/spawner';

const { WORLD, OBSTACLE } = GAME_CONFIG;

describe('Property 10: Placement des obstacles activés', () => {
  /**
   * **Validates: Requirements 4.3, 4.4**
   */
  it('bord gauche = bord droit du monde et ouverture à au moins MIN_MARGIN du sol et du plafond', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.integer({ min: 1, max: 64 }),
        fc.integer({ min: 0, max: 200 }),
        (seed, poolSize, activations) => {
          const rng = createRng(seed);
          const pool = createPool(poolSize);
          const half = OBSTACLE.GAP_HEIGHT / 2;
          const eps = 1e-9;

          for (let i = 0; i < activations; i++) {
            // Libère le pool quand il est plein pour continuer à activer.
            if (pool.items.every((o) => o.active)) releaseAll(pool);
            const o = spawnObstacle(pool, rng);
            expect(o).toBeDefined();
            if (o === undefined) return;
            expect(o.active).toBe(true);
            expect(o.x).toBe(WORLD.RIGHT);
            expect(o.gapCenterY - half).toBeGreaterThanOrEqual(WORLD.FLOOR + OBSTACLE.MIN_MARGIN - eps);
            expect(o.gapCenterY + half).toBeLessThanOrEqual(WORLD.CEILING - OBSTACLE.MIN_MARGIN + eps);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
