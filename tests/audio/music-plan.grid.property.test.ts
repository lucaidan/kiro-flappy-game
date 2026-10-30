// @vitest-environment node
import { describe, it } from 'vitest';
import fc from 'fast-check';
import { AUDIO_CONFIG } from '../../src/config/audio.config';
import { MUSIC_CONFIG } from '../../src/config/music.config';
import { beatSeconds } from '../../src/audio/timing/beat-math';
import { createEventBuffer, eventsForBeat } from '../../src/audio/music/music-plan';

const TOLERANCE_S = 1e-9;
const MAX_BEAT_INDEX = 100_000;
const MAX_AUDIO_TIME = 10_000;

// Feature: flappy-halloween-m4, Property 1: Notes sur la grille de temps
describe('Feature: flappy-halloween-m4, Property 1: Notes sur la grille de temps', () => {
  it('**Validates: Requirements 5.3, 6.3** chaque événement tombe sur la grille de doubles-croches', () => {
    const out = createEventBuffer();
    const spb = MUSIC_CONFIG.STEPS_PER_BEAT;

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_BEAT_INDEX }),
        fc.double({ min: AUDIO_CONFIG.BPM_MIN, max: AUDIO_CONFIG.BPM_MAX, noNaN: true }),
        fc.double({ min: 0, max: MAX_AUDIO_TIME, noNaN: true }),
        (beatIndex, bpm, audioTime) => {
          const beat = beatSeconds(bpm);
          const n = eventsForBeat(beatIndex, out);
          for (let i = 0; i < n; i++) {
            const e = out[i];
            if (e === undefined) return false;
            if (e.offsetBeats < 0 || e.offsetBeats >= 1) return false;
            const time = audioTime + e.offsetBeats * beat;
            const steps = (time - audioTime) / (beat / spb);
            if (Math.abs(steps - Math.round(steps)) * (beat / spb) > TOLERANCE_S) return false;
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });
});
