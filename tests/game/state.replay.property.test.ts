import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createEventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { createWorld, stepGame } from '../../src/game/state';
import type { ActionBuffer } from '../../src/game/state';

const REPLAYS = 10;

const actionArb = fc.record({
  flap: fc.boolean(),
  pause: fc.boolean(),
  mute: fc.boolean(),
});

/** Rejoue la suite d'actions et retourne une trace sérialisée de chaque pas. */
function run(seed: number, actions: readonly ActionBuffer[]): string[] {
  const world = createWorld({ seed, muted: false, bus: createEventBus<GameEvents>() });
  const trace: string[] = [];
  for (const a of actions) {
    stepGame(world, { flap: a.flap, pause: a.pause, mute: a.mute });
    const obstacles = world.pool.items
      .filter((o) => o.active)
      .map((o) => [o.x, o.gapCenterY]);
    trace.push(
      JSON.stringify({
        phase: world.phase,
        score: world.score,
        kiro: [world.kiro.x, world.kiro.y, world.kiro.vy, world.kiro.prevY, world.kiro.prevVy],
        obstacles,
      }),
    );
  }
  return trace;
}

describe('Property 13: Rejeu déterministe', () => {
  /**
   * **Validates: Requirements 3.7, 4.10, 7.12**
   */
  it('même graine et mêmes actions donnent la même trace à chaque pas sur au moins 10 rejeux', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.array(actionArb, { minLength: 1, maxLength: 400 }),
        (seed, actions) => {
          const reference = run(seed, actions);
          for (let i = 0; i < REPLAYS; i++) {
            expect(run(seed, actions)).toEqual(reference);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
