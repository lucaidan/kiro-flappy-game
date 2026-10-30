// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createEventBuffer, eventsForBeat } from '../../src/audio/music/music-plan';
import { MUSIC_CONFIG } from '../../src/config/music.config';

describe('music-plan', () => {
  it('plays a kick at offset 0 on beat 1 of bar 0', () => {
    const out = createEventBuffer();
    const n = eventsForBeat(0, out);
    const kicks = out.slice(0, n).filter((e) => e.voice === 'kick' && e.offsetBeats === 0);
    expect(kicks).toHaveLength(1);
  });

  it('emits bell and laugh on section markers when FX are enabled', () => {
    const out = createEventBuffer();
    const bellBeat = MUSIC_CONFIG.FX.BELL_BARS[0] * 4;
    const n = eventsForBeat(bellBeat, out);
    expect(out.slice(0, n).some((e) => e.voice === 'bell')).toBe(true);
    const m = eventsForBeat(MUSIC_CONFIG.FX.LAUGH_BAR * 4 + 3, out);
    expect(out.slice(0, m).some((e) => e.voice === 'laugh')).toBe(true);
  });

  it('emits no bell or laugh when FX are disabled', async () => {
    vi.resetModules();
    vi.doMock('../../src/config/music.config', async () => {
      const actual = await vi.importActual<typeof import('../../src/config/music.config')>(
        '../../src/config/music.config',
      );
      return {
        MUSIC_CONFIG: { ...actual.MUSIC_CONFIG, FX: { ...actual.MUSIC_CONFIG.FX, ENABLED: false } },
      };
    });
    const mod = await import('../../src/audio/music/music-plan');
    const out = mod.createEventBuffer();
    for (let beat = 0; beat < 32; beat++) {
      const n = mod.eventsForBeat(beat, out);
      for (let i = 0; i < n; i++) {
        expect(['bell', 'laugh']).not.toContain(out[i]?.voice);
      }
    }
    const n0 = mod.eventsForBeat(0, out);
    expect(out.slice(0, n0).some((e) => e.voice === 'kick' && e.offsetBeats === 0)).toBe(true);
    vi.doUnmock('../../src/config/music.config');
  });
});
