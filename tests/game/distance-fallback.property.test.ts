import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { GAME_CONFIG } from '../../src/config/game.config';
import { createEventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { createWorld, stepGame } from '../../src/game/state';
import type { ActionBuffer, World } from '../../src/game/state';

const actionArb = fc.record({
  flap: fc.boolean(),
  pause: fc.boolean(),
  mute: fc.boolean(),
});

const requestArb = fc.record({
  atDistance: fc.double({ min: -5, max: 40, noNaN: true }),
  gapLevels: fc.option(fc.integer({ min: 0, max: 8 }), { nil: undefined }),
});

const stepArb = fc.record({
  action: actionArb,
  plan: fc.array(requestArb, { maxLength: 4 }),
});

function make(seed: number): World {
  return createWorld({ seed, muted: true, bus: createEventBus<GameEvents>() });
}

/** Instantané des champs de simulation (sans bus ni rng, comparés via leurs effets). */
function snapshot(w: World): unknown {
  return {
    phase: w.phase,
    kiro: { ...w.kiro },
    pool: w.pool.items.map((o) => ({ ...o })),
    score: w.score,
    activatedCount: w.activatedCount,
    distanceSinceSpawn: w.distanceSinceSpawn,
    stepIndex: w.stepIndex,
    muted: w.muted,
    flapPending: w.flapPending,
    scrollSpeed: w.scrollSpeed,
    spawnMode: w.spawnMode,
  };
}

describe('Property 4: Repli Mode_Distance identique à M1', () => {
  /**
   * Feature: flappy-audio-conductor-m3, Property 4: Repli Mode_Distance identique à M1
   * **Validates: Requirements 3.3, 4.5**
   */
  it('ignore les plans parasites en Mode_Distance et garde SCROLL_SPEED', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.array(stepArb, { minLength: 1, maxLength: 200 }),
        (seed, steps) => {
          const noisy = make(seed);
          const reference = make(seed);

          for (const { action, plan } of steps) {
            noisy.spawnPlan.push(...plan);
            const a: ActionBuffer = { ...action };
            const b: ActionBuffer = { ...action };
            stepGame(noisy, a);
            stepGame(reference, b);

            expect(noisy.scrollSpeed).toBe(GAME_CONFIG.SCROLL_SPEED);
            expect(snapshot(noisy)).toEqual(snapshot(reference));
            // Le RNG doit être resté synchrone : même prochain tirage.
            expect(noisy.rng.next()).toBe(reference.rng.next());
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
