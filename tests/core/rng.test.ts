import { describe, it, expect } from 'vitest';
import { createRng, createRngFromSource } from '../../src/core/rng';

describe('RNG (unit)', () => {
  it('lève une erreur sans source de graine (2.6)', () => {
    expect(() => createRngFromSource()).toThrow('source de graine absente');
    expect(() => createRngFromSource(undefined)).toThrow();
  });

  it('dérive la graine de la source injectée (2.6, 2.7)', () => {
    const rng = createRngFromSource(() => 12345);
    expect(rng.initialSeed).toBe(12345);
    const ref = createRng(12345);
    expect(rng.next()).toBe(ref.next());
  });

  it('la graine dérivée est un entier uint32', () => {
    const rng = createRngFromSource(() => 42.9);
    expect(Number.isInteger(rng.initialSeed)).toBe(true);
    expect(rng.initialSeed).toBe(42);
  });

  it('initialSeed reste inchangée après des tirages (2.7)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 100; i++) rng.next();
    expect(rng.initialSeed).toBe(7);
  });

  it('reset rejoue la même suite depuis la graine initiale', () => {
    const rng = createRng(99);
    const first = [rng.next(), rng.next(), rng.next()];
    rng.reset();
    expect(rng.getState()).toBe(99);
    expect([rng.next(), rng.next(), rng.next()]).toEqual(first);
    expect(rng.initialSeed).toBe(99);
  });
});
