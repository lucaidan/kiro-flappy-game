import { describe, it, expect } from 'vitest';
import { GAME_CONFIG } from '../../src/config/game.config';
import { createEventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { botDecide, createBotState } from '../../src/game/bot';
import { createWorld } from '../../src/game/state';
import type { ActionBuffer, World } from '../../src/game/state';

const INTERVAL_STEPS = Math.ceil(
  GAME_CONFIG.BOT.IDLE_FLAP_INTERVAL_MS / (GAME_CONFIG.FIXED_DT * 1000),
);

function makeWorld(phase: World['phase']): World {
  const world = createWorld({ seed: 1, muted: true, bus: createEventBus<GameEvents>() });
  world.phase = phase;
  return world;
}

/** Exécute `n` pas et retourne les indices de pas où le Bot bat. */
function flapSteps(world: World, n: number): number[] {
  const bot = createBotState();
  const out: ActionBuffer = { flap: false, pause: false, mute: false };
  const steps: number[] = [];
  for (let i = 0; i < n; i++) {
    botDecide(world, bot, out);
    if (out.flap) steps.push(i);
  }
  return steps;
}

describe('Bot : battement d\'attente (Req 10.2, 10.7)', () => {
  for (const phase of ['Title', 'GameOver'] as const) {
    it(`bat au premier pas en ${phase}`, () => {
      expect(flapSteps(makeWorld(phase), 1)).toEqual([0]);
    });

    it(`bat ensuite toutes les ~500 ms en ${phase}`, () => {
      const steps = flapSteps(makeWorld(phase), INTERVAL_STEPS * 3 + 1);
      expect(steps).toEqual([0, INTERVAL_STEPS, INTERVAL_STEPS * 2, INTERVAL_STEPS * 3]);
      expect(INTERVAL_STEPS * GAME_CONFIG.FIXED_DT * 1000).toBeGreaterThanOrEqual(500);
    });
  }

  it('rebat au premier pas après être repassé par Playing', () => {
    const world = makeWorld('GameOver');
    const bot = createBotState();
    const out: ActionBuffer = { flap: false, pause: false, mute: false };
    botDecide(world, bot, out);
    botDecide(world, bot, out);
    expect(out.flap).toBe(false);
    world.phase = 'Playing';
    botDecide(world, bot, out);
    world.phase = 'GameOver';
    botDecide(world, bot, out);
    expect(out.flap).toBe(true);
  });
});
