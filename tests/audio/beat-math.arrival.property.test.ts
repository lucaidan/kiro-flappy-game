import { describe, it } from 'vitest';
import fc from 'fast-check';
import { AUDIO_CONFIG } from '../../src/config/audio.config';
import { GAME_CONFIG } from '../../src/config/game.config';
import {
  arrivalTime,
  beatSeconds,
  compensatedAdvance,
  deriveScrollSpeed,
  type TempoParams,
} from '../../src/audio/timing/beat-math';

// Feature: flappy-audio-conductor-m3, Property 1: Arrivée sur le temps
describe('Feature: flappy-audio-conductor-m3, Property 1: Arrivée sur le temps', () => {
  it('**Validates: Requirements 1.1, 1.2, 1.3** un obstacle compensé atteint PLAYER_X à arrivalTime', () => {
    const spawnX = GAME_CONFIG.WORLD.RIGHT;
    const playerX = GAME_CONFIG.KIRO.START_X;

    fc.assert(
      fc.property(
        fc.double({
          min: AUDIO_CONFIG.BPM_MIN,
          max: AUDIO_CONFIG.BPM_MAX,
          noNaN: true,
        }),
        fc.integer({
          min: AUDIO_CONFIG.TRAVEL_BEATS_MIN,
          max: AUDIO_CONFIG.TRAVEL_BEATS_MAX,
        }),
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (bpm, travelBeats, audioTime, latenessRatio) => {
          const p: TempoParams = { bpm, travelBeats, spawnX, playerX };
          const beat = beatSeconds(bpm);
          const audioNow = audioTime + latenessRatio * AUDIO_CONFIG.MAX_LATENESS_BEATS * beat;

          const speed = deriveScrollSpeed(p);
          const startX = spawnX - compensatedAdvance(speed, audioNow, audioTime);

          // Position à audioNow = startX ; temps restant jusqu'à PLAYER_X.
          const reachTime = audioNow + (startX - playerX) / speed;
          return Math.abs(reachTime - arrivalTime(audioTime, p)) <= 1e-9;
        },
      ),
      { numRuns: 200 },
    );
  });
});
