import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createEventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { createBotState, botDecide } from '../../src/game/bot';
import { createWorld, stepGame } from '../../src/game/state';
import type { ActionBuffer } from '../../src/game/state';

const SEEDS = [1, 2, 3, 7, 42, 123, 999, 2024, 31337, 65535, 1234567, 4294967295] as const;
const TARGET_OBSTACLES = 20;
/** 300 s de jeu à 60 pas par seconde. */
const MAX_STEPS = 300 * 60;
const MAX_REAL_MS = 30_000;

interface Outcome {
  score: number;
  steps: number;
  gameOver: boolean;
}

/** Simule le Bot pilotant une partie jusqu'à 20 obstacles franchis, une collision ou 300 s. */
function simulate(seed: number): Outcome {
  const world = createWorld({ seed, muted: true, bus: createEventBus<GameEvents>() });
  const bot = createBotState();
  const actions: ActionBuffer = { flap: false, pause: false, mute: false };
  let gameOver = false;
  world.bus.on('gameOver', () => {
    gameOver = true;
  });

  let steps = 0;
  while (steps < MAX_STEPS && !gameOver && world.score < TARGET_OBSTACLES) {
    botDecide(world, bot, actions);
    stepGame(world, actions);
    steps += 1;
  }
  return { score: world.score, steps, gameOver };
}

describe('Property 26: Le Bot survit', () => {
  /**
   * **Validates: Requirements 10.6, 15.6**
   */
  it('franchit au moins 20 obstacles consécutifs sans collision pour chaque graine fixe', () => {
    const start = Date.now();
    fc.assert(
      fc.property(fc.constantFrom(...SEEDS), (seed) => {
        const outcome = simulate(seed);
        expect(outcome.gameOver).toBe(false);
        expect(outcome.score).toBeGreaterThanOrEqual(TARGET_OBSTACLES);
        expect(outcome.steps).toBeLessThanOrEqual(MAX_STEPS);
      }),
      { numRuns: SEEDS.length * 3 },
    );
    expect(Date.now() - start).toBeLessThan(MAX_REAL_MS);
  });

  it('couvre chaque graine fixe explicitement (au moins 10)', () => {
    expect(SEEDS.length).toBeGreaterThanOrEqual(10);
    for (const seed of SEEDS) {
      const outcome = simulate(seed);
      expect(outcome, `graine ${seed}`).toMatchObject({ gameOver: false });
      expect(outcome.score, `graine ${seed}`).toBeGreaterThanOrEqual(TARGET_OBSTACLES);
    }
  });
});
