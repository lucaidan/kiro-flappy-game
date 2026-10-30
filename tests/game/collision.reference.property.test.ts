import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { GAME_CONFIG } from '../../src/config/game.config';
import { createPool } from '../../src/game/obstacles';
import { detectCollision } from '../../src/game/collision';

const { WORLD, OBSTACLE, KIRO } = GAME_CONFIG;
const R = KIRO.RADIUS;

const obstacleArb = fc.record({
  active: fc.boolean(),
  x: fc.double({ min: -10, max: 10, noNaN: true }),
  gapCenterY: fc.double({ min: -4, max: 4, noNaN: true }),
});

/** Modèle de référence : distance euclidienne au point le plus proche de chaque rectangle. */
function distToRect(
  px: number,
  py: number,
  l: number,
  r: number,
  b: number,
  t: number,
): number {
  const cx = Math.max(l, Math.min(px, r));
  const cy = Math.max(b, Math.min(py, t));
  return Math.hypot(px - cx, py - cy);
}

function reference(
  kx: number,
  ky: number,
  obstacles: { active: boolean; x: number; gapCenterY: number }[],
): boolean {
  if (ky - R <= WORLD.FLOOR) return true;
  if (ky + R >= WORLD.CEILING) return true;
  const half = OBSTACLE.GAP_HEIGHT / 2;
  for (const o of obstacles) {
    if (!o.active) continue;
    const l = o.x;
    const r = o.x + OBSTACLE.WIDTH;
    const dBottom = distToRect(kx, ky, l, r, WORLD.FLOOR, o.gapCenterY - half);
    const dTop = distToRect(kx, ky, l, r, o.gapCenterY + half, WORLD.CEILING);
    // Marge relative minime pour absorber hypot vs somme des carrés.
    if (dBottom <= R * (1 + 1e-12) && dBottom * dBottom <= R * R * (1 + 1e-9)) return true;
    if (dTop <= R * (1 + 1e-12) && dTop * dTop <= R * R * (1 + 1e-9)) return true;
  }
  return false;
}

describe('Property 14: Collision conforme au modèle de référence', () => {
  /**
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.9**
   */
  it('detectCollision correspond au modèle de référence et renvoie un booléen unique', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -8, max: 8, noNaN: true }),
        fc.double({ min: -6, max: 6, noNaN: true }),
        fc.array(obstacleArb, { minLength: 0, maxLength: 8 }),
        (kx, ky, obstacles) => {
          const pool = createPool(Math.max(1, obstacles.length));
          obstacles.forEach((init, i) => {
            const o = pool.items[i]!;
            o.active = init.active;
            o.x = init.x;
            o.prevX = init.x;
            o.gapCenterY = init.gapCenterY;
          });
          const result = detectCollision({ phase: 'Playing', kiro: { x: kx, y: ky }, pool });
          expect(typeof result).toBe('boolean');
          expect(result).toBe(reference(kx, ky, obstacles));
        },
      ),
      { numRuns: 500 },
    );
  });
});
