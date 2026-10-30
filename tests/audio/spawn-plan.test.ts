import { describe, expect, it } from 'vitest';
import { deriveScrollSpeed } from '../../src/audio/timing/beat-math';
import type { BeatEvent, TempoParams } from '../../src/audio/timing/beat-math';
import { buildSpawnPlan } from '../../src/audio/timing/spawn-plan';
import { AUDIO_CONFIG } from '../../src/config/audio.config';
import type { SpawnRequest } from '../../src/game/spawner';

const P: TempoParams = { bpm: 120, travelBeats: 4, spawnX: 8, playerX: -3 };
const BEAT = 0.5;

function ev(beatIndex: number, audioTime: number): BeatEvent {
  return { beatIndex, audioTime, pattern: beatIndex % AUDIO_CONFIG.BEATS_PER_BAR };
}

describe('buildSpawnPlan', () => {
  it('keeps only beats multiple of SPAWN_EVERY_BEATS', () => {
    const due = [ev(0, 10), ev(1, 10.1), ev(2, 10.2), ev(3, 10.3), ev(4, 10.4)];
    const out: SpawnRequest[] = [];
    const n = buildSpawnPlan(due, 10.5, P, out);
    expect(n).toBe(2);
    expect(out).toHaveLength(2);
  });

  it('computes compensated atDistance and includes gapLevels', () => {
    const out: SpawnRequest[] = [];
    buildSpawnPlan([ev(4, 10)], 10.2, P, out);
    expect(out[0]!.atDistance).toBeCloseTo(deriveScrollSpeed(P) * 0.2, 12);
    expect(out[0]!.gapLevels).toBe(AUDIO_CONFIG.GAP_LEVELS);
  });

  it('rejects stale events beyond MAX_LATENESS_BEATS × beat', () => {
    const out: SpawnRequest[] = [];
    const limit = AUDIO_CONFIG.MAX_LATENESS_BEATS * BEAT;
    expect(buildSpawnPlan([ev(0, 10)], 10 + limit, P, out)).toBe(1);
    expect(buildSpawnPlan([ev(0, 10)], 10 + limit + 0.001, P, out)).toBe(0);
  });

  it('rejects events in the future', () => {
    const out: SpawnRequest[] = [];
    expect(buildSpawnPlan([ev(0, 10.5)], 10, P, out)).toBe(0);
  });

  it('clears out before filling and handles empty input', () => {
    const out: SpawnRequest[] = [{ atDistance: 99 }];
    expect(buildSpawnPlan([], 10, P, out)).toBe(0);
    expect(out).toHaveLength(0);
  });

  it('throws on invalid tempo params', () => {
    expect(() => buildSpawnPlan([], 0, { ...P, bpm: 0 }, [])).toThrow(RangeError);
  });
});
