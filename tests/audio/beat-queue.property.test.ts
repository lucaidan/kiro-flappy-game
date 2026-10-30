import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createBeatQueue } from '../../src/audio/beat-queue';
import type { BeatEvent } from '../../src/audio/timing/beat-math';
import { AUDIO_CONFIG } from '../../src/config/audio.config';

const N = AUDIO_CONFIG.QUEUE_SIZE;

const toEvents = (times: number[]): BeatEvent[] =>
  times.map((audioTime, i) => ({ beatIndex: i, audioTime, pattern: i % 4 }));

// Temps audio croissants (cas réel : le Chef_Orchestre pousse dans l'ordre), avec doublons possibles.
const ascendingTimesArb = fc
  .array(fc.integer({ min: 0, max: 1000 }), { maxLength: 3 * N })
  .map((a) => a.sort((x, y) => x - y).map((x) => x / 10));

describe('Feature: flappy-audio-conductor-m3, Property 3: Ordre et bornage de la File_Temps', () => {
  /**
   * **Validates: Requirements 2.3, 2.4**
   */
  it('size is bounded, the N most recent are retained, drainDue returns exactly the due ones in ascending order', () => {
    fc.assert(
      fc.property(ascendingTimesArb, fc.integer({ min: -10, max: 1100 }), (times, tRaw) => {
        const t = tRaw / 10;
        const events = toEvents(times);
        const q = createBeatQueue(N);
        for (const e of events) {
          q.push(e);
          expect(q.size).toBeLessThanOrEqual(N);
        }
        const retained = events.slice(-N);
        expect(q.size).toBe(retained.length);

        const out: BeatEvent[] = [];
        const n = q.drainDue(t, out);
        const expectedDue = retained.filter((e) => e.audioTime <= t);
        expect(n).toBe(out.length);
        expect(out).toEqual(expectedDue);
        for (let i = 1; i < out.length; i++) {
          expect(out[i]!.audioTime).toBeGreaterThanOrEqual(out[i - 1]!.audioTime);
        }
        expect(q.size).toBe(retained.length - expectedDue.length);

        // Plus rien d'échu après le drain.
        const again: BeatEvent[] = [];
        expect(q.drainDue(t, again)).toBe(0);
        expect(again).toHaveLength(0);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 2.3, 2.4**
   */
  it('stays bounded and drains in ascending audioTime for arbitrary push order', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 1000 }), { maxLength: 3 * N }),
        fc.integer({ min: 0, max: 1000 }),
        (raw, t) => {
          const q = createBeatQueue(N);
          for (const e of toEvents(raw)) {
            q.push(e);
            expect(q.size).toBeLessThanOrEqual(N);
          }
          const out: BeatEvent[] = [];
          q.drainDue(t, out);
          for (const e of out) expect(e.audioTime).toBeLessThanOrEqual(t);
          for (let i = 1; i < out.length; i++) {
            expect(out[i]!.audioTime).toBeGreaterThanOrEqual(out[i - 1]!.audioTime);
          }
          const rest: BeatEvent[] = [];
          q.drainDue(Infinity, rest);
          for (const e of rest) expect(e.audioTime).toBeGreaterThan(t);
        },
      ),
      { numRuns: 100 },
    );
  });
});
