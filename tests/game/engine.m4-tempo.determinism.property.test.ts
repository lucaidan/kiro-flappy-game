import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AUDIO_CONFIG } from '../../src/config/audio.config';
import { GAME_CONFIG } from '../../src/config/game.config';
import { deriveScrollSpeed } from '../../src/audio/timing/beat-math';
import { createEventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { createWorld, setTimedSpawning, stepGame } from '../../src/game/state';
import type { World } from '../../src/game/state';
import type { SpawnRequest } from '../../src/game/spawner';

const M4_BPM = 120;
const M4_SPEED = deriveScrollSpeed({
  bpm: AUDIO_CONFIG.BPM,
  travelBeats: AUDIO_CONFIG.TRAVEL_BEATS,
  spawnX: GAME_CONFIG.WORLD.RIGHT,
  playerX: GAME_CONFIG.KIRO.START_X,
});

interface Step {
  plan: SpawnRequest[];
  flap: boolean;
}

const requestArb: fc.Arbitrary<SpawnRequest> = fc.oneof(
  fc.record({ atDistance: fc.double({ min: -5, max: 60, noNaN: true }) }),
  fc.record({
    atDistance: fc.double({ min: -5, max: 60, noNaN: true }),
    gapLevels: fc.integer({ min: 0, max: AUDIO_CONFIG.GAP_LEVELS }),
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

function makeWorld(seed: number): World {
  const world = createWorld({ seed, muted: false, bus: createEventBus<GameEvents>() });
  setTimedSpawning(world, M4_SPEED);
  return world;
}

describe('Property 6: Déterminisme du Moteur inchangé (tempo M4)', () => {
  it('utilise bien le tempo M4 à 120 BPM', () => {
    expect(AUDIO_CONFIG.BPM).toBe(M4_BPM);
    expect(Number.isFinite(M4_SPEED)).toBe(true);
    expect(M4_SPEED).toBeGreaterThan(0);
  });

  /**
   * Feature: flappy-halloween-m4, Property 6: Déterminisme du Moteur inchangé
   *
   * **Validates: Requirements 6.5**
   */
  it('deux exécutions à 120 BPM produisent un état identique', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.array(stepArb, { minLength: 1, maxLength: 200 }),
        (seed, steps) => {
          const a = makeWorld(seed);
          const b = makeWorld(seed);
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
