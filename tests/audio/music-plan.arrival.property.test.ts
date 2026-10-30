import { describe, it } from 'vitest';
import fc from 'fast-check';
import { AUDIO_CONFIG } from '../../src/config/audio.config';
import { GAME_CONFIG } from '../../src/config/game.config';
import { arrivalTime, beatSeconds, type TempoParams } from '../../src/audio/timing/beat-math';
import { createEventBuffer, eventsForBeat } from '../../src/audio/music/music-plan';

const EPSILON = 1e-9;
const MAX_SPAWN_SLOT = 10_000;

// Feature: flappy-halloween-m4, Property 4: Les obstacles arrivent sur la grosse caisse
describe('Feature: flappy-halloween-m4, Property 4: Les obstacles arrivent sur la grosse caisse', () => {
  it('**Validates: Requirements 6.1, 6.2** arrivée sur un Temps_Fort portant une grosse caisse', () => {
    const buf = createEventBuffer();
    const spawnX = GAME_CONFIG.WORLD.RIGHT;
    const playerX = GAME_CONFIG.KIRO.START_X;

    fc.assert(
      fc.property(
        fc.double({ min: AUDIO_CONFIG.BPM_MIN, max: AUDIO_CONFIG.BPM_MAX, noNaN: true }),
        fc.integer({ min: 0, max: MAX_SPAWN_SLOT }),
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        (bpm, slot, t0) => {
          const beatIndex = slot * AUDIO_CONFIG.SPAWN_EVERY_BEATS;
          const arrivalBeat = beatIndex + AUDIO_CONFIG.TRAVEL_BEATS;
          const p: TempoParams = {
            bpm,
            travelBeats: AUDIO_CONFIG.TRAVEL_BEATS,
            spawnX,
            playerX,
          };

          const isStrongBeat = arrivalBeat % AUDIO_CONFIG.BEATS_PER_BAR === 0;
          const expected = t0 + AUDIO_CONFIG.TRAVEL_BEATS * beatSeconds(bpm);
          const timeOk = Math.abs(arrivalTime(t0, p) - expected) <= EPSILON;

          const n = eventsForBeat(arrivalBeat, buf);
          let hasKick = false;
          for (let i = 0; i < n; i++) {
            const e = buf[i];
            if (e !== undefined && e.voice === 'kick' && e.offsetBeats === 0) hasKick = true;
          }
          return isStrongBeat && timeOk && hasKick;
        },
      ),
      { numRuns: 200 },
    );
  });
});
