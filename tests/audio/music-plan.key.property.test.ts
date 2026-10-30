import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createEventBuffer, eventsForBeat } from '../../src/audio/music/music-plan';

// Ré mineur naturel : ré, mi, fa, sol, la, si♭, do ; plus la sensible do♯.
const ALLOWED_PITCH_CLASSES = new Set([2, 4, 5, 7, 9, 10, 0, 1]);
const MELODIC = new Set(['bass', 'pad', 'lead', 'bell']);

describe('music-plan key', () => {
  // Feature: flappy-halloween-m4, Property 3: Hauteurs en ré mineur
  it('Property 3: toute voix mélodique reste en ré mineur (+ do dièse)', () => {
    // **Validates: Requirements 5.4**
    const buf = createEventBuffer();
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (beatIndex) => {
        const n = eventsForBeat(beatIndex, buf);
        for (let i = 0; i < n; i++) {
          const e = buf[i]!;
          if (!MELODIC.has(e.voice)) continue;
          expect(ALLOWED_PITCH_CLASSES.has(((e.midi % 12) + 12) % 12)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});
