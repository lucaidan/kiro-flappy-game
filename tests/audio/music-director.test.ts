import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUDIO_CONFIG } from '../../src/config/audio.config';
import { MUSIC_CONFIG } from '../../src/config/music.config';
import type { BeatEvent } from '../../src/audio/timing/beat-math';
import { createMusicDirector } from '../../src/audio/music/music-director';
import { createEventBuffer, eventsForBeat, type MusicEvent } from '../../src/audio/music/music-plan';
import type { MusicVoices } from '../../src/audio/music/music-voices';

const BEAT = 60 / AUDIO_CONFIG.BPM;

function fakeConductor() {
  const subs = new Set<(e: BeatEvent) => void>();
  return {
    onBeat(cb: (e: BeatEvent) => void) {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    fire(beatIndex: number, audioTime: number) {
      const e: BeatEvent = { beatIndex, audioTime, pattern: beatIndex % AUDIO_CONFIG.BEATS_PER_BAR };
      for (const cb of [...subs]) cb(e);
    },
    size: () => subs.size,
  };
}

function fakeVoices() {
  const played: { voice: string; offsetBeats: number; time: number; beat: number }[] = [];
  const voices: MusicVoices & { stops: number } = {
    stops: 0,
    play(e: Readonly<MusicEvent>, time: number, beatSeconds: number) {
      played.push({ voice: e.voice, offsetBeats: e.offsetBeats, time, beat: beatSeconds });
    },
    stopAll() {
      voices.stops++;
    },
  };
  return { voices, played };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('music-director', () => {
  it('planifie audioTime + offsetBeats × beat pour chaque événement du temps', () => {
    const c = fakeConductor();
    const { voices, played } = fakeVoices();
    createMusicDirector(c, voices);
    c.fire(0, 10);
    const buf = createEventBuffer();
    const n = eventsForBeat(0, buf);
    expect(played).toHaveLength(n);
    expect(played.some((p) => p.voice === 'kick' && p.time === 10)).toBe(true);
    played.forEach((p, i) => {
      expect(p.time).toBeCloseTo(10 + (buf[i]?.offsetBeats ?? 0) * BEAT, 9);
      expect(p.beat).toBeCloseTo(BEAT, 12);
    });
  });

  it('ne joue ni cloche ni rire quand FX est coupé', () => {
    const fx = MUSIC_CONFIG.FX as { ENABLED: boolean };
    const original = fx.ENABLED;
    fx.ENABLED = false;
    try {
      const c = fakeConductor();
      const { voices, played } = fakeVoices();
      createMusicDirector(c, voices);
      const total = MUSIC_CONFIG.LOOP_BARS * AUDIO_CONFIG.BEATS_PER_BAR;
      for (let i = 0; i < total; i++) c.fire(i, i * BEAT);
      expect(played.length).toBeGreaterThan(0);
      expect(played.some((p) => p.voice === 'bell' || p.voice === 'laugh')).toBe(false);
    } finally {
      fx.ENABLED = original;
    }
  });

  it('capture les exceptions des voix et continue', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = fakeConductor();
    let calls = 0;
    const voices: MusicVoices = {
      play() {
        calls++;
        throw new Error('boom');
      },
      stopAll() {},
    };
    createMusicDirector(c, voices);
    expect(() => c.fire(0, 0)).not.toThrow();
    const first = calls;
    expect(first).toBeGreaterThan(1);
    expect(() => c.fire(1, BEAT)).not.toThrow();
    expect(calls).toBeGreaterThan(first);
    expect(err).toHaveBeenCalled();
  });

  it('stopAll est relayé aux voix, même si elles lèvent', () => {
    const c = fakeConductor();
    const { voices } = fakeVoices();
    const d = createMusicDirector(c, voices);
    d.stopAll();
    expect(voices.stops).toBe(1);

    vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad: MusicVoices = {
      play() {},
      stopAll() {
        throw new Error('x');
      },
    };
    expect(() => createMusicDirector(c, bad).stopAll()).not.toThrow();
  });

  it('dispose désabonne le directeur', () => {
    const c = fakeConductor();
    const { voices, played } = fakeVoices();
    const d = createMusicDirector(c, voices);
    expect(c.size()).toBe(1);
    d.dispose();
    expect(c.size()).toBe(0);
    c.fire(0, 0);
    expect(played).toHaveLength(0);
  });
});
