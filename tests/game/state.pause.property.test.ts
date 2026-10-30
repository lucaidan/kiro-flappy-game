import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createEventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { createWorld, stepGame } from '../../src/game/state';
import type { ActionBuffer } from '../../src/game/state';

/** Actions sans pause : flap et mute sont sans effet sur la simulation en Paused. */
const noPauseArb = fc.record({
  flap: fc.boolean(),
  pause: fc.constant(false),
  mute: fc.boolean(),
});

const snapshotWorld = (w: ReturnType<typeof createWorld>) => ({
  kiro: { ...w.kiro },
  obstacles: w.pool.items.map((o) => ({ ...o })),
  score: w.score,
  rng: w.rng.getState(),
});

describe('Property 19: Pause gèle la simulation', () => {
  /**
   * **Validates: Requirements 7.5**
   */
  it('en Paused, Kiro, obstacles, score et état du RNG restent inchangés', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.integer({ min: 0, max: 40 }),
        fc.array(noPauseArb, { maxLength: 200 }),
        (seed, playSteps, pausedActions) => {
          const world = createWorld({
            seed,
            muted: false,
            bus: createEventBus<GameEvents>(),
          });
          // Démarre la partie puis joue quelques pas.
          stepGame(world, { flap: true, pause: false, mute: false });
          for (let i = 0; i < playSteps; i++) {
            stepGame(world, { flap: i % 7 === 0, pause: false, mute: false });
          }
          fc.pre(world.phase === 'Playing');

          stepGame(world, { flap: false, pause: true, mute: false });
          expect(world.phase).toBe('Paused');
          const before = snapshotWorld(world);

          for (const a of pausedActions) {
            stepGame(world, a as ActionBuffer);
            expect(world.phase).toBe('Paused');
          }

          expect(snapshotWorld(world)).toEqual(before);
        },
      ),
      { numRuns: 100 },
    );
  });
});
