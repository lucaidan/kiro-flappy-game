import { describe, it, expect } from 'vitest';
import { createEventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { GAME_CONFIG } from '../../src/config/game.config';
import { createWorld, stepGame } from '../../src/game/state';

const make = (muted = false) =>
  createWorld({ seed: 1, muted, bus: createEventBus<GameEvents>() });

describe('machine d\'états', () => {
  it('démarre en Title (7.1)', () => {
    expect(make().phase).toBe('Title');
  });

  it('Title + flap → Playing avec un seul battement appliqué (7.2)', () => {
    const world = make();
    const changes: Array<{ from: string; to: string }> = [];
    world.bus.on('stateChange', (p) => changes.push(p));

    stepGame(world, { flap: true, pause: false, mute: false });

    expect(world.phase).toBe('Playing');
    expect(changes).toEqual([{ from: 'Title', to: 'Playing' }]);
    // Un seul battement : vy = FLAP_VELOCITY + une intégration (gravité), pas deux battements.
    const expected = GAME_CONFIG.FLAP_VELOCITY + GAME_CONFIG.GRAVITY * GAME_CONFIG.FIXED_DT;
    expect(world.kiro.vy).toBeCloseTo(expected, 9);
    expect(world.stepIndex).toBe(1);
  });

  it('Title sans flap reste en Title', () => {
    const world = make();
    stepGame(world, { flap: false, pause: false, mute: false });
    expect(world.phase).toBe('Title');
  });

  it('le drapeau muet initial reflète l\'option fournie (11.4, 11.5)', () => {
    expect(make(true).muted).toBe(true);
    expect(make(false).muted).toBe(false);
  });
});
