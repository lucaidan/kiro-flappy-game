import { describe, expect, it } from 'vitest';
import { createSfx, type SfxVoices } from '../../src/audio/sfx';
import { midiToHz, scaleMidi } from '../../src/audio/timing/beat-math';
import { AUDIO_CONFIG } from '../../src/config/audio.config';
import { createEventBus, type GameEvents } from '../../src/core/events';

function setup() {
  const notes: Array<{ hz: number; db: number }> = [];
  const breaths: number[] = [];
  const voices: SfxVoices = {
    playNote: (hz, db) => notes.push({ hz, db }),
    playBreath: (db) => breaths.push(db),
  };
  const bus = createEventBus<GameEvents>();
  const sfx = createSfx(bus, voices);
  return { bus, sfx, notes, breaths };
}

describe('sfx (voix factices)', () => {
  it('joue une note qui monte d’un degré par point consécutif', () => {
    const { bus, notes } = setup();
    for (let i = 1; i <= 4; i++) bus.emit('point', { score: i });
    expect(notes.map((n) => n.hz)).toEqual([1, 2, 3, 4].map((s) => midiToHz(scaleMidi(s))));
    expect(notes[0]!.db).toBe(AUDIO_CONFIG.VOLUME_DB.POINT);
    expect(notes[1]!.hz).toBeGreaterThan(notes[0]!.hz);
  });

  it.each(['Title', 'GameOver'] as const)(
    'remet la série à zéro sur stateChange %s → Playing',
    (from) => {
      const { bus, notes } = setup();
      bus.emit('point', { score: 1 });
      bus.emit('point', { score: 2 });
      bus.emit('stateChange', { from, to: 'Playing' });
      bus.emit('point', { score: 1 });
      expect(notes[2]!.hz).toBe(notes[0]!.hz);
    },
  );

  it('ne remet pas la série à zéro à la reprise depuis Paused', () => {
    const { bus, notes } = setup();
    bus.emit('point', { score: 1 });
    bus.emit('stateChange', { from: 'Paused', to: 'Playing' });
    bus.emit('point', { score: 2 });
    expect(notes[1]!.hz).toBe(midiToHz(scaleMidi(2)));
  });

  it('joue un souffle à chaque flap, sans note', () => {
    const { bus, notes, breaths } = setup();
    bus.emit('flap', { stepIndex: 0 });
    bus.emit('flap', { stepIndex: 5 });
    expect(breaths).toEqual([AUDIO_CONFIG.VOLUME_DB.FLAP, AUDIO_CONFIG.VOLUME_DB.FLAP]);
    expect(notes).toHaveLength(0);
  });

  it('dispose désabonne les écouteurs (idempotent)', () => {
    const { bus, sfx, notes, breaths } = setup();
    sfx.dispose();
    sfx.dispose();
    bus.emit('point', { score: 1 });
    bus.emit('flap', { stepIndex: 0 });
    expect(notes).toHaveLength(0);
    expect(breaths).toHaveLength(0);
  });
});
