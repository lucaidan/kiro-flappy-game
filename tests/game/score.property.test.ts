import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { GAME_CONFIG } from '../../src/config/game.config';
import { createEventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { createRng } from '../../src/core/rng';
import { createPool } from '../../src/game/obstacles';
import { updateScore } from '../../src/game/score';
import { spawnObstacle } from '../../src/game/spawner';
import { createWorld, stepGame } from '../../src/game/state';

const { OBSTACLE } = GAME_CONFIG;

describe('Property 17: Score cohérent avec les franchissements', () => {
  /**
   * **Validates: Requirements 6.1, 6.2, 6.3**
   */
  it('chaque obstacle franchi ajoute exactement 1 une seule fois et publie point avec le nouveau score', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.array(fc.integer({ min: -2000, max: 2000 }), { minLength: 0, maxLength: 16 }),
        fc.integer({ min: 0, max: 4 }),
        (seed, offsets, inactiveCount) => {
          const bus = createEventBus<GameEvents>();
          const points: number[] = [];
          bus.on('point', (p) => points.push(p.score));
          const rng = createRng(seed);
          const pool = createPool(32);
          const kiro = { x: 0 };
          const world = { kiro, pool, score: 0, bus };

          for (const off of offsets) {
            const o = spawnObstacle(pool, rng);
            if (o === undefined) return;
            o.x = kiro.x + off;
            o.prevX = o.x;
          }
          // Obstacles inactifs situés derrière Kiro : ne doivent jamais compter.
          for (let i = 0; i < inactiveCount; i++) {
            const o = pool.items[offsets.length + i];
            if (o !== undefined) o.x = kiro.x - 5000;
          }

          const expected = offsets.filter((off) => off + OBSTACLE.WIDTH < 0).length;
          updateScore(world);
          expect(world.score).toBe(expected);
          expect(Number.isInteger(world.score)).toBe(true);
          expect(points).toEqual(Array.from({ length: expected }, (_, i) => i + 1));

          // Une seule fois par activation : un second appel n'a aucun effet.
          updateScore(world);
          expect(world.score).toBe(expected);
          expect(points.length).toBe(expected);
          expect(world.score).toBeLessThanOrEqual(offsets.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 6.5, 6.7**
   */
  it('en partie : score entier dans [0, activés], points séquentiels, aucun point ni changement en GameOver', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 600 }),
        (seed, flaps) => {
          const bus = createEventBus<GameEvents>();
          let points: number[] = [];
          bus.on('point', (p) => points.push(p.score));
          const world = createWorld({ seed, muted: false, bus });
          const actions = { flap: false, pause: false, mute: false };

          let prevScore = 0;
          for (const flap of flaps) {
            actions.flap = flap;
            const before = world.phase;
            points = [];
            stepGame(world, actions);

            expect(Number.isInteger(world.score)).toBe(true);
            expect(world.score).toBeGreaterThanOrEqual(0);
            expect(world.score).toBeLessThanOrEqual(world.activatedCount);

            if (before === 'GameOver' && world.phase === 'GameOver') {
              expect(points).toEqual([]);
              expect(world.score).toBe(prevScore);
            }
            if (world.phase === 'Playing' && before === 'Playing') {
              // +1 par point, chaque événement porte le nouveau score (≥ 1).
              expect(world.score - prevScore).toBe(points.length);
              points.forEach((s, i) => expect(s).toBe(prevScore + i + 1));
            }
            prevScore = world.score;
          }

          // Une fois en GameOver, des pas sans battement ne changent rien et ne publient rien.
          if (world.phase === 'GameOver') {
            const final = world.score;
            points = [];
            actions.flap = false;
            for (let i = 0; i < 20; i++) stepGame(world, actions);
            expect(world.score).toBe(final);
            expect(points).toEqual([]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
