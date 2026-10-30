import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { GAME_CONFIG } from '../../src/config/game.config';
import { createEventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { createWorld, stepGame } from '../../src/game/state';

describe('Property 20: Réinitialisation de la partie', () => {
  /**
   * **Validates: Requirements 7.6**
   */
  it('un battement en GameOver remet la partie à zéro et passe à Playing', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 60 }),
        (seed, flaps) => {
          const world = createWorld({
            seed,
            muted: false,
            bus: createEventBus<GameEvents>(),
          });
          // Démarre, joue avec des battements aléatoires, puis laisse Kiro tomber.
          stepGame(world, { flap: true, pause: false, mute: false });
          for (const flap of flaps) {
            stepGame(world, { flap, pause: false, mute: false });
          }
          for (let i = 0; i < 3000 && world.phase === 'Playing'; i++) {
            stepGame(world, { flap: false, pause: false, mute: false });
          }
          fc.pre(world.phase === 'GameOver');

          stepGame(world, { flap: true, pause: false, mute: false });

          expect(world.phase).toBe('Playing');
          expect(world.kiro.x).toBe(GAME_CONFIG.KIRO.START_X);
          expect(world.kiro.y).toBe(GAME_CONFIG.KIRO.START_Y);
          expect(world.kiro.vy).toBe(0);
          expect(world.pool.items.some((o) => o.active)).toBe(false);
          expect(world.score).toBe(0);
          expect(world.rng.getState()).toBe(world.rng.initialSeed);
        },
      ),
      { numRuns: 100 },
    );
  });
});
