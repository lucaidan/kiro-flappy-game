import { describe, expect, it } from 'vitest';
import {
  arrivalTime,
  beatSeconds,
  compensatedAdvance,
  deriveScrollSpeed,
  midiToHz,
  scaleMidi,
} from '../../src/audio/timing/beat-math';
import type { TempoParams } from '../../src/audio/timing/beat-math';

const P: TempoParams = { bpm: 120, travelBeats: 4, spawnX: 8, playerX: -3 };

describe('beatSeconds', () => {
  it('returns 60 / bpm', () => {
    expect(beatSeconds(110)).toBeCloseTo(0.5454545, 6);
    expect(beatSeconds(120)).toBe(0.5);
  });

  it('accepts the bounds and rejects values outside', () => {
    expect(beatSeconds(60)).toBe(1);
    expect(beatSeconds(180)).toBeCloseTo(1 / 3, 12);
    expect(() => beatSeconds(59.9)).toThrow(RangeError);
    expect(() => beatSeconds(180.1)).toThrow(RangeError);
    expect(() => beatSeconds(NaN)).toThrow(RangeError);
    expect(() => beatSeconds(Infinity)).toThrow(RangeError);
  });
});

describe('deriveScrollSpeed', () => {
  it('gives ≈ 5.04 at 110 BPM, 4 beats, distance 11', () => {
    expect(deriveScrollSpeed(P)).toBeCloseTo(5.5, 2);
    expect(deriveScrollSpeed(P)).toBeCloseTo(11 / (4 * (60 / 120)), 12);
  });

  it('rejects invalid travelBeats', () => {
    expect(() => deriveScrollSpeed({ ...P, travelBeats: 0 })).toThrow(RangeError);
    expect(() => deriveScrollSpeed({ ...P, travelBeats: 17 })).toThrow(RangeError);
    expect(() => deriveScrollSpeed({ ...P, travelBeats: 2.5 })).toThrow(RangeError);
    expect(() => deriveScrollSpeed({ ...P, travelBeats: 1 })).not.toThrow();
    expect(() => deriveScrollSpeed({ ...P, travelBeats: 16 })).not.toThrow();
  });

  it('rejects invalid bpm and non-positive distance', () => {
    expect(() => deriveScrollSpeed({ ...P, bpm: 0 })).toThrow(RangeError);
    expect(() => deriveScrollSpeed({ ...P, spawnX: -3 })).toThrow(RangeError);
    expect(() => deriveScrollSpeed({ ...P, spawnX: -4 })).toThrow(RangeError);
    expect(() => deriveScrollSpeed({ ...P, spawnX: NaN })).toThrow(RangeError);
  });
});

describe('arrivalTime', () => {
  it('adds travelBeats × beat', () => {
    expect(arrivalTime(10, P)).toBe(12);
    expect(arrivalTime(0, P)).toBeCloseTo(4 * (60 / 120), 12);
  });

  it('rejects invalid params', () => {
    expect(() => arrivalTime(0, { ...P, bpm: 10 })).toThrow(RangeError);
    expect(() => arrivalTime(0, { ...P, travelBeats: 0 })).toThrow(RangeError);
  });
});

describe('compensatedAdvance', () => {
  it('multiplies speed by elapsed time', () => {
    expect(compensatedAdvance(5, 10.2, 10)).toBeCloseTo(1, 12);
  });

  it('clamps negative elapsed time to 0', () => {
    expect(compensatedAdvance(5, 9, 10)).toBe(0);
  });
});

describe('scaleMidi / midiToHz', () => {
  it('maps streak to the D minor scale, looping over 2 octaves', () => {
    expect(scaleMidi(1)).toBe(62);
    expect(scaleMidi(2)).toBe(64);
    expect(scaleMidi(7)).toBe(72);
    expect(scaleMidi(8)).toBe(74);
    expect(scaleMidi(15)).toBe(62);
  });

  it('A4 is 440 Hz and octaves double', () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(81)).toBeCloseTo(880, 9);
  });
});
