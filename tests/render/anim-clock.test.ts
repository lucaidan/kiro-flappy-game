import { describe, it, expect } from 'vitest';
import { RENDER_CONFIG } from '../../src/config/render.config';
import { advanceAnimClock, createAnimClock } from '../../src/render/anim-clock';

const MAX_DT = RENDER_CONFIG.ANIM.MAX_DT;

describe('advanceAnimClock', () => {
  it("n'avance pas au premier appel (3.7)", () => {
    const clock = createAnimClock();
    expect(advanceAnimClock(clock, 100, true)).toBe(0);
  });

  it('avance de Δt quand running est vrai (3.7)', () => {
    const clock = createAnimClock();
    advanceAnimClock(clock, 10, true);
    const dt = MAX_DT / 2;
    expect(advanceAnimClock(clock, 10 + dt, true)).toBeCloseTo(dt, 10);
    expect(advanceAnimClock(clock, 10 + 2 * dt, true)).toBeCloseTo(2 * dt, 10);
  });

  it('reste gelée quand running est faux (3.7)', () => {
    const clock = createAnimClock();
    advanceAnimClock(clock, 0, true);
    advanceAnimClock(clock, MAX_DT / 2, true);
    const frozen = clock.time;
    expect(advanceAnimClock(clock, MAX_DT, false)).toBe(frozen);
    expect(advanceAnimClock(clock, 2 * MAX_DT, false)).toBe(frozen);
  });

  it('plafonne Δt à ANIM.MAX_DT après une longue pause (3.8)', () => {
    const clock = createAnimClock();
    advanceAnimClock(clock, 0, true);
    expect(advanceAnimClock(clock, 1000, true)).toBe(MAX_DT);
  });

  it('ignore un Δt négatif (horloge qui recule)', () => {
    const clock = createAnimClock();
    advanceAnimClock(clock, 5, true);
    expect(advanceAnimClock(clock, 4, true)).toBe(0);
  });

  it('ignore un échantillon non fini (3.8)', () => {
    const clock = createAnimClock();
    advanceAnimClock(clock, 0, true);
    advanceAnimClock(clock, MAX_DT / 2, true);
    const before = { ...clock };
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      expect(advanceAnimClock(clock, bad, true)).toBe(before.time);
      expect(clock).toEqual(before);
    }
  });

  it("ignore un premier échantillon non fini sans démarrer l'horloge", () => {
    const clock = createAnimClock();
    expect(advanceAnimClock(clock, Number.NaN, true)).toBe(0);
    expect(clock.started).toBe(false);
  });
});
