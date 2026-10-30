import type { MusicEvent } from './music-plan';

/** Instruments de la musique ; implémentés par l'adaptateur Tone. */
export interface MusicVoices {
  /** Joue l'événement à l'instant audio absolu `time` (secondes). */
  play(e: Readonly<MusicEvent>, time: number, beatSeconds: number): void;
  /** Libère les notes en cours et coupe les notes déjà planifiées. */
  stopAll(): void;
}
