import { describe, expect, it } from 'vitest';
import { AUDIO_CONFIG } from '../../src/config/audio.config';
import { MUSIC_CONFIG } from '../../src/config/music.config';

function collectLeaves(value: unknown, path: string, out: Array<[string, unknown]>): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => collectLeaves(v, `${path}[${i}]`, out));
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collectLeaves(v, `${path}.${k}`, out);
  } else {
    out.push([path, value]);
  }
}

describe('AUDIO_CONFIG', () => {
  it('has only finite numbers or strings as leaves', () => {
    const leaves: Array<[string, unknown]> = [];
    collectLeaves(AUDIO_CONFIG, 'AUDIO_CONFIG', leaves);
    expect(leaves.length).toBeGreaterThan(0);
    for (const [path, v] of leaves) {
      const ok = typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));
      expect(ok, path).toBe(true);
    }
  });

  it('keeps BPM within [BPM_MIN, BPM_MAX]', () => {
    expect(AUDIO_CONFIG.BPM_MIN).toBeLessThan(AUDIO_CONFIG.BPM_MAX);
    expect(AUDIO_CONFIG.BPM).toBeGreaterThanOrEqual(AUDIO_CONFIG.BPM_MIN);
    expect(AUDIO_CONFIG.BPM).toBeLessThanOrEqual(AUDIO_CONFIG.BPM_MAX);
  });

  it('keeps TRAVEL_BEATS an integer within its bounds', () => {
    expect(Number.isInteger(AUDIO_CONFIG.TRAVEL_BEATS)).toBe(true);
    expect(AUDIO_CONFIG.TRAVEL_BEATS).toBeGreaterThanOrEqual(AUDIO_CONFIG.TRAVEL_BEATS_MIN);
    expect(AUDIO_CONFIG.TRAVEL_BEATS).toBeLessThanOrEqual(AUDIO_CONFIG.TRAVEL_BEATS_MAX);
  });

  it('M4: BPM in [118, 120] and TRAVEL_BEATS is a multiple of BEATS_PER_BAR', () => {
    expect(AUDIO_CONFIG.BPM).toBeGreaterThanOrEqual(118);
    expect(AUDIO_CONFIG.BPM).toBeLessThanOrEqual(120);
    expect(AUDIO_CONFIG.TRAVEL_BEATS % AUDIO_CONFIG.BEATS_PER_BAR).toBe(0);
  });

  it('M4: music volumes are finite and below POINT', () => {
    const v = AUDIO_CONFIG.VOLUME_DB;
    const music = Object.entries(v).filter(([k]) => k.startsWith('MUSIC_'));
    expect(music.length).toBe(8);
    for (const [k, db] of music) {
      expect(Number.isFinite(db), k).toBe(true);
      expect(db, k).toBeLessThan(v.POINT);
    }
  });

  it('M4: MUSIC_CONFIG patterns are consistent with the grid', () => {
    const steps = MUSIC_CONFIG.STEPS_PER_BEAT * AUDIO_CONFIG.BEATS_PER_BAR;
    expect(MUSIC_CONFIG.LOOP_BARS).toBe(8);
    expect(MUSIC_CONFIG.CHORD_ROOTS).toHaveLength(MUSIC_CONFIG.LOOP_BARS);
    expect(MUSIC_CONFIG.CHORD_TYPES).toHaveLength(MUSIC_CONFIG.LOOP_BARS);
    for (const p of [MUSIC_CONFIG.KICK, MUSIC_CONFIG.SNARE, MUSIC_CONFIG.HAT, MUSIC_CONFIG.BASS]) {
      expect(p).toHaveLength(steps);
    }
    expect(MUSIC_CONFIG.LEAD).toHaveLength(MUSIC_CONFIG.LOOP_BARS);
    for (const bar of MUSIC_CONFIG.LEAD) expect(bar).toHaveLength(steps);
    expect(MUSIC_CONFIG.KICK[0]).toBeGreaterThan(0);
  });

  it('has a positive integer queue size and gap levels >= 2', () => {
    expect(Number.isInteger(AUDIO_CONFIG.QUEUE_SIZE)).toBe(true);
    expect(AUDIO_CONFIG.QUEUE_SIZE).toBeGreaterThan(0);
    expect(AUDIO_CONFIG.GAP_LEVELS).toBeGreaterThanOrEqual(2);
  });
});
