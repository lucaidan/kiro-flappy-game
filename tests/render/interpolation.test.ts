import { describe, it, expect } from 'vitest';
import type { GameStateName } from '../../src/core/events';
import { effectiveAlpha } from '../../src/render/interpolation';

describe('effectiveAlpha', () => {
  it('borne Alpha à [0, 1] en Playing (8.3)', () => {
    expect(effectiveAlpha('Playing', 0.25)).toBe(0.25);
    expect(effectiveAlpha('Playing', 0)).toBe(0);
    expect(effectiveAlpha('Playing', 1)).toBe(1);
    expect(effectiveAlpha('Playing', -3)).toBe(0);
    expect(effectiveAlpha('Playing', 7)).toBe(1);
    expect(effectiveAlpha('Playing', Number.NEGATIVE_INFINITY)).toBe(0);
    expect(effectiveAlpha('Playing', Number.POSITIVE_INFINITY)).toBe(1);
  });

  it('vaut 0 pour NaN en Playing (8.3)', () => {
    expect(effectiveAlpha('Playing', Number.NaN)).toBe(0);
  });

  it('vaut 1 dans Title, Paused et GameOver quel que soit Alpha (8.4, 8.5)', () => {
    const phases: GameStateName[] = ['Title', 'Paused', 'GameOver'];
    for (const phase of phases) {
      for (const alpha of [0, 0.5, 1, -2, 9, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(effectiveAlpha(phase, alpha)).toBe(1);
      }
    }
  });
});
