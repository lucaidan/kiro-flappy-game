import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { AUDIO_CONFIG } from '../../src/config/audio.config';
import { MUSIC_CONFIG } from '../../src/config/music.config';
import { createEventBuffer, eventsForBeat } from '../../src/audio/music/music-plan';

// Feature: flappy-halloween-m4, Property 2: Boucle de 8 mesures
describe('Feature: flappy-halloween-m4, Property 2: Boucle de 8 mesures', () => {
  it('**Validates: Requirements 5.2** eventsForBeat(i) est identique à eventsForBeat(i + 8 mesures)', () => {
    const loopBeats = MUSIC_CONFIG.LOOP_BARS * AUDIO_CONFIG.BEATS_PER_BAR;
    const a = createEventBuffer();
    const b = createEventBuffer();

    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (beatIndex) => {
        const na = eventsForBeat(beatIndex, a);
        const nb = eventsForBeat(beatIndex + loopBeats, b);
        expect(nb).toBe(na);
        expect(b.slice(0, nb)).toEqual(a.slice(0, na));
      }),
      { numRuns: 100 },
    );
  });
});
