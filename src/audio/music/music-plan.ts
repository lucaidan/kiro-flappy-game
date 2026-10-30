import { AUDIO_CONFIG } from '../../config/audio.config';
import { MUSIC_CONFIG } from '../../config/music.config';

export type VoiceId = 'kick' | 'snare' | 'hat' | 'bass' | 'pad' | 'lead' | 'bell' | 'laugh';

export interface MusicEvent {
  voice: VoiceId;
  /** Décalage en temps dans [0, 1[, multiple de 1 / STEPS_PER_BEAT. */
  offsetBeats: number;
  /** Note MIDI ; 0 pour les voix percussives. */
  midi: number;
  durationBeats: number;
  velocity: number;
}

/** Capacité suffisante pour un temps (4 pas × 5 voix + pad 3 + cloche + rire). */
export const MAX_EVENTS_PER_BEAT = 28;

const BASS_VELOCITY = 0.9;
const LEAD_VELOCITY = 0.8;
const PAD_VELOCITY = 0.5;
const BELL_VELOCITY = 0.7;
const LAUGH_VELOCITY = 0.8;
const BELL_MIDI = 81; // la 5 (dans la gamme de ré mineur)
const PAD_OFFSETS_MIN = [12, 15, 19] as const;
const PAD_OFFSETS_MAJ = [12, 16, 19] as const;

function push(
  out: MusicEvent[],
  n: number,
  voice: VoiceId,
  offsetBeats: number,
  midi: number,
  durationBeats: number,
  velocity: number,
): number {
  const e = out[n];
  if (e === undefined) return n;
  e.voice = voice;
  e.offsetBeats = offsetBeats;
  e.midi = midi;
  e.durationBeats = durationBeats;
  e.velocity = velocity;
  return n + 1;
}

/** Remplit `out` (préalloué) avec les événements du temps `beatIndex` ; retourne leur nombre. */
export function eventsForBeat(beatIndex: number, out: MusicEvent[]): number {
  const spb = MUSIC_CONFIG.STEPS_PER_BEAT;
  const beatsPerBar = AUDIO_CONFIG.BEATS_PER_BAR;
  const loopBeats = MUSIC_CONFIG.LOOP_BARS * beatsPerBar;
  const b = ((beatIndex % loopBeats) + loopBeats) % loopBeats;
  const bar = Math.floor(b / beatsPerBar);
  const beatInBar = b - bar * beatsPerBar;
  const root = MUSIC_CONFIG.CHORD_ROOTS[bar] ?? 0;
  const isMinor = MUSIC_CONFIG.CHORD_TYPES[bar] === 'min';
  const fx = MUSIC_CONFIG.FX;
  let n = 0;

  for (let k = 0; k < spb; k++) {
    const step = beatInBar * spb + k;
    const off = k / spb;

    const kick = MUSIC_CONFIG.KICK[step] ?? 0;
    if (kick > 0) n = push(out, n, 'kick', off, 0, 0.25, kick);
    const snare = MUSIC_CONFIG.SNARE[step] ?? 0;
    if (snare > 0) n = push(out, n, 'snare', off, 0, 0.25, snare);
    const hat = MUSIC_CONFIG.HAT[step] ?? 0;
    if (hat > 0) n = push(out, n, 'hat', off, 0, 0.125, hat);

    const bass = MUSIC_CONFIG.BASS[step] ?? -1;
    if (bass >= 0) {
      const ghost = (MUSIC_CONFIG.BASS_GHOST_STEPS as readonly number[]).includes(step);
      const vel = ghost ? MUSIC_CONFIG.GHOST_NOTE_VELOCITY : BASS_VELOCITY;
      n = push(out, n, 'bass', off, root + bass, 0.25, vel);
    }

    const lead = MUSIC_CONFIG.LEAD[bar]?.[step] ?? 0;
    if (lead > 0) n = push(out, n, 'lead', off, lead, 0.5, LEAD_VELOCITY);
  }

  if (beatInBar === 0) {
    const offsets = isMinor ? PAD_OFFSETS_MIN : PAD_OFFSETS_MAJ;
    for (let i = 0; i < offsets.length; i++) {
      n = push(out, n, 'pad', 0, root + (offsets[i] ?? 0), beatsPerBar, PAD_VELOCITY);
    }
    if (fx.ENABLED && (fx.BELL_BARS as readonly number[]).includes(bar)) {
      n = push(out, n, 'bell', 0, BELL_MIDI, 2, BELL_VELOCITY);
    }
  }
  if (fx.ENABLED && bar === fx.LAUGH_BAR && beatInBar === beatsPerBar - 1) {
    n = push(out, n, 'laugh', 0, 0, 1, LAUGH_VELOCITY);
  }
  return n;
}

/** Crée un tampon réutilisable pour `eventsForBeat`. */
export function createEventBuffer(size: number = MAX_EVENTS_PER_BEAT): MusicEvent[] {
  const buf: MusicEvent[] = [];
  for (let i = 0; i < size; i++) {
    buf.push({ voice: 'kick', offsetBeats: 0, midi: 0, durationBeats: 0, velocity: 0 });
  }
  return buf;
}
