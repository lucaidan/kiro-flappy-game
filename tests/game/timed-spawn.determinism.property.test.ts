import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createEventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { createWorld, setTimedSpawning, stepGame } from '../../src/game/state';
import type { World } from '../../src/game/state';
import type { SpawnRequest } from '../../src/game/spawner';

interface Step {
  plan: SpawnRequest[];
  flap: boolean;
}

const requestArb: fc.Arbitrary<SpawnRequest> = fc.oneof(
  fc.record({ atDistance: fc.double({ min: -5, max: 60, noNaN: true }) }),
  fc.record({
    atDistance: fc.double({ min: -5, max: 60, noNaN: true }),
    gapLevels: fc.integer({ min: 0, max: 8 }),
  }),
);

const stepArb: fc.Arbitrary<Step> = fc.record({
  plan: fc.array(requestArb, { maxLength: 3 }),
  flap: fc.boolean(),
});

function snapshot(world: World): string {
  return JSON.stringify({
    phase: world.phase,
    score: world.score,
    activatedCount: world.activatedCount,
    rng: world.rng.getState(),
    obstacles: world.pool.items.map((o) => [o.active, o.x, o.prevX, o.gapCenterY]),
  });
}

function makeWorld(seed: number, scrollSpeed: number): World {
  const world = createWorld({ seed, muted: false, bus: createEventBus<GameEvents>() });
  setTimedSpawning(world, scrollSpeed);
  return world;
}

describe('Property 2: Déterminisme du Moteur en Mode_Temps', () => {
  /**
   * Feature: flappy-audio-conductor-m3, Property 2: Déterminisme du Moteur en Mode_Temps
   *
   * **Validates: Requirements 3.1, 3.2, 3.4, 3.5**
   */
  it('deux mondes avec mêmes entrées ont un état identique après chaque pas', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.double({ min: 0.01, max: 0.5, noNaN: true }),
        fc.array(stepArb, { minLength: 1, maxLength: 200 }),
        (seed, speed, steps) => {
          const a = makeWorld(seed, speed);
          const b = makeWorld(seed, speed);
          for (const s of steps) {
            a.spawnPlan.push(...s.plan.map((r) => ({ ...r })));
            b.spawnPlan.push(...s.plan.map((r) => ({ ...r })));
            stepGame(a, { flap: s.flap, pause: false, mute: false });
            stepGame(b, { flap: s.flap, pause: false, mute: false });
            expect(snapshot(a)).toBe(snapshot(b));
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
