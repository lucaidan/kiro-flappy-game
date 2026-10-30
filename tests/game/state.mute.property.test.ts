import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createEventBus } from '../../src/core/events';
import type { GameEvents, GameStateName } from '../../src/core/events';
import { createWorld, stepGame } from '../../src/game/state';

const phaseArb = fc.constantFrom<GameStateName>('Title', 'Playing', 'Paused', 'GameOver');

describe('Property 27: Le muet est une involution', () => {
  /**
   * **Validates: Requirements 11.6**
   */
  it('mute bascule `muted`, publie un muteChange avec la nouvelle valeur, et deux mutes restituent la valeur initiale', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.boolean(),
        phaseArb,
        (seed, initial, phase) => {
          const bus = createEventBus<GameEvents>();
          const received: boolean[] = [];
          bus.on('muteChange', (p) => received.push(p.muted));
          const world = createWorld({ seed, muted: initial, bus });
          world.phase = phase;

          const mute = { flap: false, pause: false, mute: true };

          stepGame(world, mute);
          expect(world.muted).toBe(!initial);
          expect(received).toEqual([!initial]);

          stepGame(world, mute);
          expect(world.muted).toBe(initial);
          expect(received).toEqual([!initial, initial]);
        },
      ),
      { numRuns: 100 },
    );
  });
});
