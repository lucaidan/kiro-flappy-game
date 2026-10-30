import { describe, it, expect } from 'vitest';
import { GAME_CONFIG } from '../../src/config/game.config';
import { createEventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { createRng } from '../../src/core/rng';
import { acquire, createPool, scrollObstacles } from '../../src/game/obstacles';
import { applySpawnPlan } from '../../src/game/spawner';
import { createWorld, setTimedSpawning, stepGame } from '../../src/game/state';

const { WORLD, OBSTACLE, FIXED_DT } = GAME_CONFIG;
const halfGap = OBSTACLE.GAP_HEIGHT / 2;
const MIN = WORLD.FLOOR + OBSTACLE.MIN_MARGIN + halfGap;
const MAX = WORLD.CEILING - OBSTACLE.MIN_MARGIN - halfGap;

const makeWorld = () => createWorld({ seed: 7, muted: false, bus: createEventBus<GameEvents>() });
const noAction = { flap: false, pause: false, mute: false };

describe('applySpawnPlan : position compensée', () => {
  it('place x à RIGHT − atDistance et aligne prevX (3.2)', () => {
    const pool = createPool(4);
    const n = applySpawnPlan(pool, createRng(1), [{ atDistance: 2.5 }]);
    const o = pool.items.find((i) => i.active)!;
    expect(n).toBe(1);
    expect(o.x).toBeCloseTo(WORLD.RIGHT - 2.5, 12);
    expect(o.prevX).toBe(o.x);
  });

  it('borne atDistance à [0, RIGHT − LEFT]', () => {
    const pool = createPool(4);
    applySpawnPlan(pool, createRng(1), [{ atDistance: -5 }, { atDistance: 1e9 }]);
    const [a, b] = pool.items;
    expect(a!.x).toBe(WORLD.RIGHT);
    expect(b!.x).toBe(WORLD.RIGHT - (WORLD.RIGHT - WORLD.LEFT));
  });

  it('quantifie gapCenterY sur gapLevels niveaux dans [MIN, MAX]', () => {
    const pool = createPool(32);
    const requests = Array.from({ length: 32 }, () => ({ atDistance: 0, gapLevels: 5 }));
    applySpawnPlan(pool, createRng(3), requests);
    const step = (MAX - MIN) / 4;
    for (const o of pool.items) {
      const idx = (o.gapCenterY - MIN) / step;
      expect(Math.abs(idx - Math.round(idx))).toBeLessThan(1e-9);
      expect(o.gapCenterY).toBeGreaterThanOrEqual(MIN - 1e-9);
      expect(o.gapCenterY).toBeLessThanOrEqual(MAX + 1e-9);
    }
  });

  it('gapLevels = 2 ne produit que MIN ou MAX ; sans gapLevels, valeur continue conservée', () => {
    const pool = createPool(16);
    applySpawnPlan(
      pool,
      createRng(5),
      Array.from({ length: 16 }, () => ({ atDistance: 0, gapLevels: 2 })),
    );
    for (const o of pool.items) {
      const isEdge = Math.abs(o.gapCenterY - MIN) < 1e-9 || Math.abs(o.gapCenterY - MAX) < 1e-9;
      expect(isEdge).toBe(true);
    }

    const raw = createRng(5);
    const pool2 = createPool(1);
    applySpawnPlan(pool2, createRng(5), [{ atDistance: 0 }]);
    expect(pool2.items[0]!.gapCenterY).toBe(raw.float(MIN, MAX));
  });
});

describe('scrollObstacles avec world.scrollSpeed', () => {
  it('décale de scrollSpeed × FIXED_DT (3.1)', () => {
    const pool = createPool(2);
    const o = acquire(pool)!;
    scrollObstacles(pool, 12);
    expect(o.x).toBeCloseTo(WORLD.RIGHT - 12 * FIXED_DT, 12);
    expect(o.prevX).toBe(WORLD.RIGHT);
  });

  it('stepGame en Mode_Temps utilise world.scrollSpeed', () => {
    const world = makeWorld();
    setTimedSpawning(world, 9);
    stepGame(world, { ...noAction, flap: true }); // Title → Playing
    world.spawnPlan.push({ atDistance: 1 });
    stepGame(world, noAction);
    const o = world.pool.items.find((i) => i.active)!;
    expect(o.x).toBeCloseTo(WORLD.RIGHT - 1, 12);
    stepGame(world, { ...noAction, flap: true });
    expect(o.x).toBeCloseTo(WORLD.RIGHT - 1 - 9 * FIXED_DT, 12);
  });
});

describe('stepGame en Mode_Temps', () => {
  it('émet flap et vide spawnPlan, en incrémentant activatedCount (3.4)', () => {
    const world = makeWorld();
    setTimedSpawning(world, 8);
    const flaps: number[] = [];
    world.bus.on('flap', (p) => flaps.push(p.stepIndex));

    stepGame(world, { ...noAction, flap: true });
    expect(flaps).toEqual([0]);

    world.spawnPlan.push({ atDistance: 0 }, { atDistance: 3 });
    stepGame(world, { ...noAction, flap: true });
    expect(flaps).toEqual([0, 1]);
    expect(world.spawnPlan).toHaveLength(0);
    expect(world.activatedCount).toBe(2);
  });

  it('n\'active aucun obstacle par distance en Mode_Temps', () => {
    const world = makeWorld();
    setTimedSpawning(world, 8);
    stepGame(world, { ...noAction, flap: true });
    expect(world.activatedCount).toBe(0);
  });
});

describe('Pool plein', () => {
  it('ne consomme pas le RNG et retourne 0 (5.2)', () => {
    const pool = createPool(2);
    while (acquire(pool) !== undefined) {
      /* remplir */
    }
    const rng = createRng(11);
    const reference = createRng(11);
    const n = applySpawnPlan(pool, rng, [
      { atDistance: 1, gapLevels: 4 },
      { atDistance: 2 },
    ]);
    expect(n).toBe(0);
    expect(rng.float(0, 1)).toBe(reference.float(0, 1));
  });

  it('active seulement les places libres puis ignore le reste', () => {
    const pool = createPool(2);
    const n = applySpawnPlan(pool, createRng(2), [
      { atDistance: 0 },
      { atDistance: 0 },
      { atDistance: 0 },
    ]);
    expect(n).toBe(2);
  });
});
