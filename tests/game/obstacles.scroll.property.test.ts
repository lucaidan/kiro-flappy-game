import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { GAME_CONFIG } from '../../src/config/game.config';
import { createPool, scrollObstacles } from '../../src/game/obstacles';

const { SCROLL_SPEED, FIXED_DT, WORLD, OBSTACLE } = GAME_CONFIG;
const DX = SCROLL_SPEED * FIXED_DT;

/** Obstacle initial : actif ou non, bord gauche dans et autour du monde. */
const initialArb = fc.record({
  active: fc.boolean(),
  x: fc.double({ min: -14, max: 12, noNaN: true }),
});

describe('Property 9: Défilement des obstacles', () => {
  /**
   * **Validates: Requirements 4.2, 4.6**
   */
  it('déplace chaque obstacle actif de SCROLL_SPEED × FIXED_DT et désactive ceux sortis à gauche', () => {
    fc.assert(
      fc.property(
        fc.array(initialArb, { minLength: 1, maxLength: 64 }),
        fc.integer({ min: 1, max: 300 }),
        (initials, steps) => {
          const pool = createPool(initials.length);
          initials.forEach((init, i) => {
            const o = pool.items[i]!;
            o.active = init.active;
            o.x = init.x;
            o.prevX = init.x;
          });
          // Modèle de référence.
          const model = initials.map((i) => ({ active: i.active, x: i.x }));

          for (let s = 0; s < steps; s++) {
            const before = pool.items.map((o) => ({ active: o.active, x: o.x }));
            scrollObstacles(pool);
            for (let i = 0; i < model.length; i++) {
              const m = model[i]!;
              const o = pool.items[i]!;
              if (!m.active) {
                // Un obstacle inactif reste inchangé.
                expect(o.active).toBe(false);
                expect(o.x).toBe(before[i]!.x);
                continue;
              }
              m.x -= DX;
              if (m.x + OBSTACLE.WIDTH < WORLD.LEFT) m.active = false;
              expect(o.x).toBe(m.x);
              expect(o.prevX).toBe(before[i]!.x);
              expect(o.active).toBe(m.active);
              // Sortie strictement à gauche => désactivé dans le même pas.
              if (o.x + OBSTACLE.WIDTH < WORLD.LEFT) expect(o.active).toBe(false);
              else expect(o.active).toBe(true);
            }
          }
          expect(pool.items.length).toBe(initials.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});
