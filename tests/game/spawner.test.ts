import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import { createPool } from '../../src/game/obstacles';
import { applySpawnPlan } from '../../src/game/spawner';

describe('applySpawnPlan', () => {
  it('liste vide : 0 activation, pool et RNG inchangés', () => {
    const pool = createPool(4);
    const rng = createRng(42);
    const stateBefore = rng.getState();
    expect(applySpawnPlan(pool, rng, [])).toBe(0);
    expect(pool.items.every((o) => !o.active)).toBe(true);
    expect(rng.getState()).toBe(stateBefore);
  });

  it('active autant d’obstacles que de demandes, dans la limite du pool', () => {
    const pool = createPool(2);
    const rng = createRng(1);
    const reqs = [{ atDistance: 0 }, { atDistance: 1 }, { atDistance: 2 }];
    expect(applySpawnPlan(pool, rng, reqs)).toBe(2);
  });
});
