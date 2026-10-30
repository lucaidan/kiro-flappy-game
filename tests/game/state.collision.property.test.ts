import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { GAME_CONFIG } from '../../src/config/game.config';
import { createEventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { detectCollision } from '../../src/game/collision';
import { createPool } from '../../src/game/obstacles';
import { createWorld, stepGame } from '../../src/game/state';
import type { ActionBuffer, World } from '../../src/game/state';

const { FLOOR, CEILING } = GAME_CONFIG.WORLD;
const { RADIUS } = GAME_CONFIG.KIRO;

/** Position de Kiro qui reste en collision avec le sol ou le plafond après un pas. */
const collidingYArb = fc.oneof(
  fc.double({ min: FLOOR - 2, max: FLOOR + 0.2, noNaN: true }),
  fc.double({ min: CEILING, max: CEILING + 2, noNaN: true }),
);

const seedArb = fc.integer({ min: 0, max: 0xffffffff });

function makeWorld(seed: number) {
  const bus = createEventBus<GameEvents>();
  const changes: GameEvents['stateChange'][] = [];
  const overs: GameEvents['gameOver'][] = [];
  bus.on('stateChange', (p) => changes.push(p));
  bus.on('gameOver', (p) => overs.push(p));
  const world: World = createWorld({ seed, muted: false, bus });
  return { world, changes, overs };
}

describe('Property 16: Collision et phase de jeu', () => {
  /**
   * **Validates: Requirements 5.5, 5.8, 5.9**
   */
  it('une collision en Playing mène à GameOver dans le même pas, avec une seule transition', () => {
    fc.assert(
      fc.property(seedArb, collidingYArb, fc.boolean(), (seed, y, flap) => {
        const { world, changes, overs } = makeWorld(seed);
        world.phase = 'Playing';
        world.kiro.y = y;
        world.kiro.vy = 0;

        stepGame(world, { flap, pause: false, mute: false } as ActionBuffer);

        expect(world.phase).toBe('GameOver');
        expect(changes).toEqual([{ from: 'Playing', to: 'GameOver' }]);
        expect(overs).toEqual([{ score: world.score }]);

        // Aucun événement supplémentaire sans battement ensuite.
        stepGame(world, { flap: false, pause: false, mute: false } as ActionBuffer);
        expect(world.phase).toBe('GameOver');
        expect(changes).toHaveLength(1);
        expect(overs).toHaveLength(1);
      }),
      { numRuns: 100 },
    );
  });

  it('detectCollision vaut false hors Playing, même en contact', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Title', 'Paused', 'GameOver'),
        collidingYArb,
        fc.double({ min: -10, max: 10, noNaN: true }),
        (phase, y, x) => {
          const pool = createPool(GAME_CONFIG.POOL_SIZE);
          expect(detectCollision({ phase, kiro: { x, y }, pool })).toBe(false);
          // Contrôle : le même état en Playing est bien une collision.
          expect(detectCollision({ phase: 'Playing', kiro: { x, y }, pool })).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('en Paused, un pas sans pause n’émet ni collision ni gameOver', () => {
    fc.assert(
      fc.property(seedArb, collidingYArb, (seed, y) => {
        const { world, changes, overs } = makeWorld(seed);
        world.phase = 'Paused';
        world.kiro.y = y;
        stepGame(world, { flap: false, pause: false, mute: false } as ActionBuffer);
        expect(world.phase).toBe('Paused');
        expect(changes).toHaveLength(0);
        expect(overs).toHaveLength(0);
        expect(RADIUS).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});
