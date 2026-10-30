import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { GAME_CONFIG } from '../../src/config/game.config';
import { createEventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { botDecide, createBotState } from '../../src/game/bot';
import { createWorld } from '../../src/game/state';
import type { ActionBuffer, World } from '../../src/game/state';

const { WORLD, OBSTACLE, KIRO, BOT } = GAME_CONFIG;
const MID_Y = (WORLD.FLOOR + WORLD.CEILING) / 2;

interface ObstacleSpec {
  active: boolean;
  dx: number;
  gapCenterY: number;
}

const obstacleArb = fc.record({
  active: fc.boolean(),
  dx: fc.double({ min: -20, max: 60, noNaN: true }),
  gapCenterY: fc.double({ min: WORLD.FLOOR, max: WORLD.CEILING, noNaN: true }),
});

function buildWorld(
  phase: World['phase'],
  y: number,
  vy: number,
  specs: ObstacleSpec[],
): World {
  const world = createWorld({ seed: 1, muted: true, bus: createEventBus<GameEvents>() });
  world.phase = phase;
  world.kiro.y = y;
  world.kiro.vy = vy;
  specs.slice(0, world.pool.items.length).forEach((s, i) => {
    const o = world.pool.items[i]!;
    o.active = s.active;
    o.x = world.kiro.x + s.dx;
    o.prevX = o.x;
    o.gapCenterY = s.gapCenterY;
  });
  return world;
}

/** Modèle de référence de la cible en Playing. */
function referenceTarget(world: World): number {
  const kiroLeft = world.kiro.x - KIRO.RADIUS;
  let target = MID_Y;
  let bestX = Infinity;
  for (const o of world.pool.items) {
    if (!o.active) continue;
    if (o.x + OBSTACLE.WIDTH > kiroLeft && o.x < bestX) {
      bestX = o.x;
      target = o.gapCenterY;
    }
  }
  return target;
}

function decide(world: World): boolean {
  const out: ActionBuffer = { flap: false, pause: false, mute: false };
  botDecide(world, createBotState(), out);
  return out.flap;
}

const yArb = fc.double({ min: WORLD.FLOOR - 5, max: WORLD.CEILING + 5, noNaN: true });
const vyArb = fc.double({ min: -30, max: 30, noNaN: true });

describe('Property 25: Décision du Bot', () => {
  /**
   * **Validates: Requirements 10.3, 10.4, 10.5**
   */
  it('en Playing, bat exactement quand y < cible - TOLERANCE et vy <= 0', () => {
    fc.assert(
      fc.property(yArb, vyArb, fc.array(obstacleArb, { maxLength: 8 }), (y, vy, specs) => {
        const world = buildWorld('Playing', y, vy, specs);
        const expected = y < referenceTarget(world) - BOT.TOLERANCE && vy <= 0;
        expect(decide(world)).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 10.4, 10.5**
   */
  it('en Playing, ne bat jamais à la cible - TOLERANCE ou au-dessus, ni sans obstacle au-dessus du milieu', () => {
    fc.assert(
      fc.property(
        vyArb,
        fc.array(obstacleArb, { maxLength: 8 }),
        fc.double({ min: 0, max: 20, noNaN: true }),
        (vy, specs, extra) => {
          const world = buildWorld('Playing', 0, vy, specs);
          world.kiro.y = referenceTarget(world) - BOT.TOLERANCE + extra;
          expect(decide(world)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 10.1, 10.3**
   */
  it('est déterministe, au plus un battement par pas et ne modifie pas le monde', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<World['phase']>('Title', 'Playing', 'Paused', 'GameOver'),
        yArb,
        vyArb,
        fc.array(obstacleArb, { maxLength: 8 }),
        (phase, y, vy, specs) => {
          const world = buildWorld(phase, y, vy, specs);
          const snapshot = JSON.stringify({
            phase: world.phase,
            kiro: world.kiro,
            pool: world.pool.items,
            score: world.score,
            activatedCount: world.activatedCount,
            distanceSinceSpawn: world.distanceSinceSpawn,
            stepIndex: world.stepIndex,
            flapPending: world.flapPending,
          });
          const rng = world.rng;
          const out1: ActionBuffer = { flap: true, pause: false, mute: false };
          const out2: ActionBuffer = { flap: true, pause: false, mute: false };
          botDecide(world, createBotState(), out1);
          botDecide(world, createBotState(), out2);
          expect(out1.flap).toBe(out2.flap);
          expect(typeof out1.flap).toBe('boolean');
          expect(out1.pause).toBe(false);
          expect(out1.mute).toBe(false);
          expect(world.rng).toBe(rng);
          expect(
            JSON.stringify({
              phase: world.phase,
              kiro: world.kiro,
              pool: world.pool.items,
              score: world.score,
              activatedCount: world.activatedCount,
              distanceSinceSpawn: world.distanceSinceSpawn,
              stepIndex: world.stepIndex,
              flapPending: world.flapPending,
            }),
          ).toBe(snapshot);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 10.8**
   */
  it('état invalide : aucune action et aucune exception', () => {
    const badArb = fc.constantFrom<unknown>(NaN, Infinity, -Infinity, undefined, null, 'x', {});
    fc.assert(
      fc.property(
        fc.constantFrom<World['phase']>('Title', 'Playing', 'Paused', 'GameOver'),
        badArb,
        badArb,
        fc.constantFrom('y', 'vy', 'both'),
        (phase, badY, badVy, which) => {
          const world = buildWorld(phase, 0, 0, []);
          const kiro = world.kiro as unknown as Record<string, unknown>;
          if (which !== 'vy') kiro.y = badY;
          if (which !== 'y') kiro.vy = badVy;
          const out: ActionBuffer = { flap: true, pause: false, mute: false };
          expect(() => botDecide(world, createBotState(), out)).not.toThrow();
          expect(out.flap).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
