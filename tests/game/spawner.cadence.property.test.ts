import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { GAME_CONFIG } from '../../src/config/game.config';
import { createRng } from '../../src/core/rng';
import { createPool } from '../../src/game/obstacles';
import { runDistanceSpawner } from '../../src/game/spawner';
import type { SpawnerWorld } from '../../src/game/spawner';

const { SPAWN_DISTANCE } = GAME_CONFIG.OBSTACLE;
const STEP_DISTANCE = GAME_CONFIG.SCROLL_SPEED * GAME_CONFIG.FIXED_DT;

describe('Property 11: Cadence de spawn par distance', () => {
  /**
   * **Validates: Requirements 4.5**
   */
  it("le nombre d'activations vaut 1 + floor(distance parcourue / SPAWN_DISTANCE), à tolérance flottante près", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.integer({ min: 0, max: 1000 }),
        (seed, steps) => {
          // Pool maximal et sans défilement : aucune saturation ni recyclage.
          const world: SpawnerWorld = {
            pool: createPool(64),
            rng: createRng(seed),
            // Même valeur initiale que createWorld : activation immédiate.
            distanceSinceSpawn: SPAWN_DISTANCE,
            activatedCount: 0,
          };

          for (let i = 0; i < steps; i++) runDistanceSpawner(world);

          // Modèle tolérant : l'accumulation flottante peut décaler une frontière.
          const ratio = 1 + (steps * STEP_DISTANCE) / SPAWN_DISTANCE;
          const eps = 1e-6;
          const lower = Math.floor(ratio - eps);
          const upper = Math.floor(ratio + eps);

          expect(world.activatedCount).toBeGreaterThanOrEqual(lower);
          expect(world.activatedCount).toBeLessThanOrEqual(upper);
          expect(world.pool.items.filter((o) => o.active).length).toBe(world.activatedCount);
        },
      ),
      { numRuns: 100 },
    );
  });
});
