import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createEventBus } from '../../src/core/events';
import type { GameEvents, GameStateName } from '../../src/core/events';
import { createWorld, stepGame, transition } from '../../src/game/state';
import type { ActionBuffer, World } from '../../src/game/state';

const PHASES: readonly GameStateName[] = ['Title', 'Playing', 'Paused', 'GameOver'];

/** Table de référence (7.10), indépendante de l'implémentation. */
const ALLOWED_EDGES: ReadonlySet<string> = new Set([
  'Title>Playing',
  'Playing>Paused',
  'Paused>Playing',
  'Playing>GameOver',
  'GameOver>Playing',
]);

const phaseArb = fc.constantFrom(...PHASES);
const actionArb = fc.record({
  flap: fc.boolean(),
  pause: fc.boolean(),
  mute: fc.boolean(),
});

interface Recorded {
  world: World;
  changes: { from: GameStateName; to: GameStateName; phaseAtEmit: GameStateName }[];
  gameOvers: { score: number; phaseAtEmit: GameStateName }[];
}

function makeWorld(seed: number, phase: GameStateName, score: number): Recorded {
  const bus = createEventBus<GameEvents>();
  const world = createWorld({ seed, muted: false, bus });
  world.phase = phase;
  world.score = score;
  const rec: Recorded = { world, changes: [], gameOvers: [] };
  bus.on('stateChange', (p) =>
    rec.changes.push({ from: p.from, to: p.to, phaseAtEmit: world.phase }),
  );
  bus.on('gameOver', (p) => rec.gameOvers.push({ score: p.score, phaseAtEmit: world.phase }));
  return rec;
}

describe('Property 18: Table de transitions de la machine d’états', () => {
  /**
   * **Validates: Requirements 7.3, 7.4, 7.7, 7.8, 7.9, 7.10, 7.11**
   */
  it('transition n’accepte que les arêtes de la table, avec exactement un stateChange', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        phaseArb,
        phaseArb,
        fc.integer({ min: 0, max: 1000 }),
        (seed, from, to, score) => {
          const rec = makeWorld(seed, from, score);
          const ok = transition(rec.world, to);
          const allowed = ALLOWED_EDGES.has(`${from}>${to}`);
          expect(ok).toBe(allowed);
          if (allowed) {
            expect(rec.world.phase).toBe(to);
            expect(rec.changes).toEqual([{ from, to, phaseAtEmit: to }]);
            if (to === 'GameOver') {
              expect(rec.gameOvers).toEqual([{ score, phaseAtEmit: 'GameOver' }]);
            } else {
              expect(rec.gameOvers).toHaveLength(0);
            }
          } else {
            expect(rec.world.phase).toBe(from);
            expect(rec.world.score).toBe(score);
            expect(rec.changes).toHaveLength(0);
            expect(rec.gameOvers).toHaveLength(0);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('stepGame n’effectue que des transitions autorisées, chaînées et publiées après mise à jour', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.array(actionArb, { minLength: 1, maxLength: 150 }),
        (seed, actions) => {
          const rec = makeWorld(seed, 'Title', 0);
          const { world } = rec;
          for (const a of actions) {
            const before = world.phase;
            rec.changes.length = 0;
            rec.gameOvers.length = 0;
            stepGame(world, a as ActionBuffer);

            let cursor = before;
            for (const c of rec.changes) {
              expect(c.from).toBe(cursor);
              expect(ALLOWED_EDGES.has(`${c.from}>${c.to}`)).toBe(true);
              expect(c.phaseAtEmit).toBe(c.to);
              cursor = c.to;
            }
            expect(world.phase).toBe(cursor);

            const toGameOver = rec.changes.filter((c) => c.to === 'GameOver').length;
            expect(rec.gameOvers).toHaveLength(toGameOver);
            for (const g of rec.gameOvers) {
              expect(g.phaseAtEmit).toBe('GameOver');
              expect(g.score).toBe(world.score);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('pause en Title/GameOver et battement en Paused sont ignorés sans événement', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.constantFrom<GameStateName>('Title', 'GameOver', 'Paused'),
        fc.integer({ min: 0, max: 1000 }),
        (seed, phase, score) => {
          const rec = makeWorld(seed, phase, score);
          const { world } = rec;
          // Title/GameOver : pause seule ; Paused : battement seul.
          const action: ActionBuffer =
            phase === 'Paused'
              ? { flap: true, pause: false, mute: false }
              : { flap: false, pause: true, mute: false };
          const yBefore = world.kiro.y;
          const vyBefore = world.kiro.vy;
          stepGame(world, action);
          expect(world.phase).toBe(phase);
          expect(world.score).toBe(score);
          expect(world.kiro.y).toBe(yBefore);
          expect(world.kiro.vy).toBe(vyBefore);
          expect(rec.changes).toHaveLength(0);
          expect(rec.gameOvers).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Playing + pause → Paused, puis Paused + pause → Playing, un stateChange chacun', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
        const rec = makeWorld(seed, 'Playing', 0);
        stepGame(rec.world, { flap: false, pause: true, mute: false });
        expect(rec.world.phase).toBe('Paused');
        stepGame(rec.world, { flap: false, pause: true, mute: false });
        expect(rec.world.phase).toBe('Playing');
        expect(rec.changes.map((c) => `${c.from}>${c.to}`)).toEqual([
          'Playing>Paused',
          'Paused>Playing',
        ]);
      }),
      { numRuns: 100 },
    );
  });
});
