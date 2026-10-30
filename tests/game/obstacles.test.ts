import { describe, expect, it } from 'vitest';
import { createPool } from '../../src/game/obstacles';

describe('createPool', () => {
  it.each([1, 8, 64])('crée %i obstacles inactifs', (n) => {
    const pool = createPool(n);
    expect(pool.items).toHaveLength(n);
    expect(pool.items.every((o) => !o.active)).toBe(true);
  });

  it.each([0, -1, 65, 1.5, NaN, Infinity])('rejette la taille %s', (n) => {
    expect(() => createPool(n)).toThrow();
  });
});
