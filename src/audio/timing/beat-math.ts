import { AUDIO_CONFIG } from '../../config/audio.config';

/** Evenement poussé par le Chef_Orchestre à chaque temps. `pattern = beatIndex % BEATS_PER_BAR`. */
export interface BeatEvent {
  beatIndex: number;
  audioTime: number;
  pattern: number;
}

export interface TempoParams {
  bpm: number;
  travelBeats: number;
  spawnX: number;
  playerX: number;
}

function assertBpm(bpm: number): void {
  if (!Number.isFinite(bpm) || bpm < AUDIO_CONFIG.BPM_MIN || bpm > AUDIO_CONFIG.BPM_MAX) {
    throw new RangeError(
      `BPM invalide : ${bpm} (attendu entre ${AUDIO_CONFIG.BPM_MIN} et ${AUDIO_CONFIG.BPM_MAX})`,
    );
  }
}

function assertTravelBeats(travelBeats: number): void {
  if (
    !Number.isInteger(travelBeats) ||
    travelBeats < AUDIO_CONFIG.TRAVEL_BEATS_MIN ||
    travelBeats > AUDIO_CONFIG.TRAVEL_BEATS_MAX
  ) {
    throw new RangeError(
      `travelBeats invalide : ${travelBeats} (entier attendu entre ${AUDIO_CONFIG.TRAVEL_BEATS_MIN} et ${AUDIO_CONFIG.TRAVEL_BEATS_MAX})`,
    );
  }
}

/** Durée d'un temps en secondes. */
export function beatSeconds(bpm: number): number {
  assertBpm(bpm);
  return 60 / bpm;
}

/** Vitesse de défilement : distance / (travelBeats × beat). */
export function deriveScrollSpeed(p: TempoParams): number {
  assertTravelBeats(p.travelBeats);
  const beat = beatSeconds(p.bpm);
  const distance = p.spawnX - p.playerX;
  if (!Number.isFinite(distance) || distance <= 0) {
    throw new RangeError(`Distance invalide : ${distance} (spawnX doit dépasser playerX)`);
  }
  return distance / (p.travelBeats * beat);
}

/** Temps audio auquel un obstacle né à `audioTime` atteint `playerX`. */
export function arrivalTime(audioTime: number, p: TempoParams): number {
  assertTravelBeats(p.travelBeats);
  return audioTime + p.travelBeats * beatSeconds(p.bpm);
}

/** Distance déjà parcourue depuis SPAWN_X : speed × max(0, now − time). */
export function compensatedAdvance(speed: number, audioNow: number, audioTime: number): number {
  return speed * Math.max(0, audioNow - audioTime);
}

/** Note MIDI du degré `streak − 1` de la gamme, bouclant sur 2 octaves. */
export function scaleMidi(streak: number): number {
  const steps = AUDIO_CONFIG.SCALE.STEPS;
  const n = steps.length;
  const degree = Math.max(0, Math.trunc(streak) - 1) % (2 * n);
  const octave = Math.floor(degree / n);
  return AUDIO_CONFIG.SCALE.ROOT_MIDI + 12 * octave + steps[degree % n]!;
}

/** Fréquence en Hz d'une note MIDI (La4 = 69 = 440 Hz). */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
