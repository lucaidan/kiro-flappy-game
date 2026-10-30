import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { GameStateName } from '../../src/core/events';
import { screenFor } from '../../src/ui/screen-view';
import { BEST_SCORE_KEY, loadBest, saveBest } from '../../src/ui/best-score';

const PHASES: GameStateName[] = ['Title', 'Playing', 'Paused', 'GameOver'];

function fakeStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(BEST_SCORE_KEY, initial);
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('ui properties', () => {
  // Feature: flappy-finition-m5, Property 4: Un seul écran par phase
  // **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
  it('Property 4: chaque phase a un écran distinct', () => {
    fc.assert(
      fc.property(fc.constantFrom(...PHASES), fc.constantFrom(...PHASES), (a, b) => {
        const sa = screenFor(a);
        expect(typeof sa).toBe('string');
        expect(screenFor(a)).toBe(sa);
        if (a !== b) expect(sa).not.toBe(screenFor(b));
      }),
      { numRuns: 100 },
    );
  });

  // Feature: flappy-finition-m5, Property 5: Le meilleur score est le maximum
  // **Validates: Requirements 4.1**
  it('Property 5: le meilleur score stocké est le maximum de la séquence', () => {
    fc.assert(
      fc.property(fc.array(fc.nat({ max: 1_000_000 })), (scores) => {
        const storage = fakeStorage();
        for (const s of scores) saveBest(storage, s);
        expect(loadBest(storage)).toBe(scores.length === 0 ? 0 : Math.max(...scores));
      }),
      { numRuns: 100 },
    );
  });

  // Feature: flappy-finition-m5, Property 6: Aller-retour du meilleur score
  // **Validates: Requirements 4.4**
  it('Property 6: saveBest puis loadBest redonne le score', () => {
    fc.assert(
      fc.property(fc.nat({ max: Number.MAX_SAFE_INTEGER }), (score) => {
        const storage = fakeStorage();
        saveBest(storage, score);
        expect(loadBest(storage)).toBe(score);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: flappy-finition-m5, Property 7: Lecture robuste
  // **Validates: Requirements 4.2, 4.3**
  it('Property 7: loadBest renvoie un entier fini >= 0 sans lever', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const n = loadBest(fakeStorage(raw));
        expect(Number.isFinite(n)).toBe(true);
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 },
    );
    expect(loadBest(undefined)).toBe(0);
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadBest(throwing)).toBe(0);
  });
});
