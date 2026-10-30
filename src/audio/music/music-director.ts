import { AUDIO_CONFIG } from '../../config/audio.config';
import type { Conductor } from '../conductor';
import { beatSeconds, type BeatEvent } from '../timing/beat-math';
import { createEventBuffer, eventsForBeat } from './music-plan';
import type { MusicVoices } from './music-voices';

export interface MusicDirector {
  /** Coupe toutes les voix (pause, Game Over). */
  stopAll(): void;
  /** Se désabonne du Chef_Orchestre. */
  dispose(): void;
}

/** Planifie la musique à chaque temps ; les erreurs des voix ne remontent jamais. */
export function createMusicDirector(
  conductor: Pick<Conductor, 'onBeat'>,
  voices: MusicVoices,
): MusicDirector {
  const buffer = createEventBuffer();
  const beat = beatSeconds(AUDIO_CONFIG.BPM);

  const unsubscribe = conductor.onBeat((e: BeatEvent) => {
    const count = eventsForBeat(e.beatIndex, buffer);
    for (let i = 0; i < count; i++) {
      const ev = buffer[i];
      if (ev === undefined) continue;
      try {
        voices.play(ev, e.audioTime + ev.offsetBeats * beat, beat);
      } catch (err) {
        console.error('Voix musicale en échec', err);
      }
    }
  });

  return {
    stopAll(): void {
      try {
        voices.stopAll();
      } catch (err) {
        console.error('Arrêt des voix en échec', err);
      }
    },
    dispose(): void {
      unsubscribe();
    },
  };
}
