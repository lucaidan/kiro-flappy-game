import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { GAME_CONFIG } from '../../src/config/game.config';
import { createEventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { createWorld, stepGame } from '../../src/game/state';
import type { ActionBuffer } from '../../src/game/state';

const { START_X, START_Y } = GAME_CONFIG.KIRO;

/** Actions sans battement : pause et mute restent possibles en Title. */
const noFlapArb = fc.record({
  flap: fc.constant(false),
  pause: fc.boolean(),
  mute: fc.boolean(),
});

describe('Property 7: Kiro immobile en Title', () => {
  /**
   * **Validates: Requirements 3.5**
   */
  it('garde Kiro à sa position initiale, vitesse nulle, tant qu’aucun battement ne survient', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.array(noFlapArb, { minLength: 1, maxLength: 200 }),
        (seed, actions) => {
          const world = createWorld({
            seed,
            muted: false,
            bus: createEventBus<GameEvents>(),
          });
          for (const a of actions) {
            stepGame(world, a as ActionBuffer);
            expect(world.phase).toBe('Title');
            expect(world.kiro.x).toBe(START_X);
            expect(world.kiro.y).toBe(START_Y);
            expect(world.kiro.vy).toBe(0);
            expect(world.kiro.prevY).toBe(START_Y);
            expect(world.kiro.prevVy).toBe(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('le premier battement fait passer en Playing, après quoi Kiro peut bouger', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.array(noFlapArb, { maxLength: 50 }),
        (seed, idle) => {
          const world = createWorld({
            seed,
            muted: false,
            bus: createEventBus<GameEvents>(),
          });
          for (const a of idle) stepGame(world, a as ActionBuffer);
          expect(world.kiro.y).toBe(START_Y);
          stepGame(world, { flap: true, pause: false, mute: false });
          expect(world.phase).toBe('Playing');
        },
      ),
      { numRuns: 100 },
    );
  });
});
