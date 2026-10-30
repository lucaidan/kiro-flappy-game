import { describe, expect, it } from 'vitest';
import { createEventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { createPool } from '../../src/game/obstacles';
import { updateScore } from '../../src/game/score';
import { createWorld, stepGame } from '../../src/game/state';

const noAction = { flap: false, pause: false, mute: false };

describe('updateScore', () => {
  function setup(obstacleX: number) {
    const pool = createPool(1);
    const o = pool.items[0];
    if (o === undefined) throw new Error('pool vide');
    o.active = true;
    o.x = obstacleX;
    const bus = createEventBus<GameEvents>();
    const points: number[] = [];
    bus.on('point', (p) => points.push(p.score));
    return { world: { kiro: { x: 0 }, pool, score: 0, bus }, o, points };
  }

  it('ne marque pas tant que le bord droit n’est pas strictement à gauche (6.4)', () => {
    // bord droit = -1.2 + 1.2 = 0 : égal au centre de Kiro
    const { world, points } = setup(-1.2);
    updateScore(world);
    expect(world.score).toBe(0);
    expect(points).toEqual([]);
  });

  it('marque une fois et publie point', () => {
    const { world, o, points } = setup(-1.25);
    updateScore(world);
    updateScore(world);
    expect(world.score).toBe(1);
    expect(o.passed).toBe(true);
    expect(points).toEqual([1]);
  });
});

describe('score dans stepGame', () => {
  it('vaut 0 au démarrage (6.6)', () => {
    const world = createWorld({ seed: 1, muted: false, bus: createEventBus<GameEvents>() });
    expect(world.score).toBe(0);
  });

  it('n’attribue pas de point au pas de la collision', () => {
    const bus = createEventBus<GameEvents>();
    const points: number[] = [];
    bus.on('point', (p) => points.push(p.score));
    const world = createWorld({ seed: 1, muted: false, bus });
    world.phase = 'Playing';
    world.kiro.y = -4.7; // collision avec le sol à ce pas
    const o = world.pool.items[0];
    if (o === undefined) throw new Error('pool vide');
    o.active = true;
    o.x = -4.5; // déjà franchi par Kiro (x = -3)
    o.passed = false;

    stepGame(world, noAction);

    expect(world.phase).toBe('GameOver');
    expect(world.score).toBe(0);
    expect(o.passed).toBe(false);
    expect(points).toEqual([]);
  });
});
