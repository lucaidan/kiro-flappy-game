import { AUDIO_CONFIG } from '../config/audio.config';
import type { EventBus, GameEvents } from '../core/events';
import { midiToHz, scaleMidi } from './timing/beat-math';

export interface SfxVoices {
  playNote(hz: number, db: number): void;
  playBreath(db: number): void;
}

/** Note de point (gamme, série croissante) et souffle d'aile non quantifié. */
export function createSfx(bus: EventBus<GameEvents>, voices: SfxVoices): { dispose(): void } {
  let streak = 0;

  const offs = [
    bus.on('point', () => {
      streak += 1;
      voices.playNote(midiToHz(scaleMidi(streak)), AUDIO_CONFIG.VOLUME_DB.POINT);
    }),
    bus.on('flap', () => {
      voices.playBreath(AUDIO_CONFIG.VOLUME_DB.FLAP);
    }),
    bus.on('stateChange', ({ from, to }) => {
      if (to === 'Playing' && (from === 'Title' || from === 'GameOver')) streak = 0;
    }),
  ];

  let disposed = false;
  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const off of offs) off();
    },
  };
}
