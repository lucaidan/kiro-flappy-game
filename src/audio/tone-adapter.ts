import * as Tone from 'tone';
import { AUDIO_CONFIG } from '../config/audio.config';
import type { ToneApi, TransportLike } from './conductor';
import type { SfxVoices } from './sfx';
import type { MusicEvent } from './music/music-plan';
import type { MusicVoices } from './music/music-voices';

/** Seul fichier qui importe `tone` : construit l'API du conductor et les voix SFX. */
export function createToneAdapter(): { api: ToneApi; voices: SfxVoices; musicVoices: MusicVoices } {
  const destination = Tone.getDestination();
  destination.volume.value = AUDIO_CONFIG.VOLUME_DB.MASTER;

  let noteSynth: Tone.Synth | null = null;
  let noiseSynth: Tone.NoiseSynth | null = null;

  const getNoteSynth = (): Tone.Synth => {
    noteSynth ??= new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.1 },
    }).connect(destination);
    return noteSynth;
  };

  const getNoiseSynth = (): Tone.NoiseSynth => {
    noiseSynth ??= new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.005, decay: 0.08, sustain: 0, release: 0.05 },
    }).connect(destination);
    return noiseSynth;
  };

  const api: ToneApi = {
    start: () => Tone.start(),
    now: () => Tone.now(),
    transport: () => Tone.getTransport() as unknown as TransportLike,
    setOutputMuted(m: boolean): void {
      destination.mute = m;
    },
  };

  const voices: SfxVoices = {
    playNote(hz: number, db: number): void {
      const synth = getNoteSynth();
      synth.volume.value = db;
      synth.triggerAttackRelease(hz, '16n');
    },
    playBreath(db: number): void {
      const synth = getNoiseSynth();
      synth.volume.value = db;
      synth.triggerAttackRelease('32n');
    },
  };

  return { api, voices, musicVoices: createMusicVoices(destination) };
}

/** Instruments de la musique, créés à la première note jouée (après `Tone.start()`). */
function createMusicVoices(destination: Tone.ToneAudioNode): MusicVoices {
  const vol = AUDIO_CONFIG.VOLUME_DB;
  /** Nœuds à libérer ensemble (instruments + effets). */
  const created: { dispose(): unknown }[] = [];
  const track = <T extends { dispose(): unknown }>(node: T): T => {
    created.push(node);
    return node;
  };

  let bass: Tone.MonoSynth | null = null;
  let kick: Tone.MembraneSynth | null = null;
  let snare: Tone.NoiseSynth | null = null;
  let hat: Tone.NoiseSynth | null = null;
  let pad: Tone.PolySynth | null = null;
  let lead: Tone.Synth | null = null;
  let bell: Tone.FMSynth | null = null;
  let laugh: Tone.NoiseSynth | null = null;

  const getBass = (): Tone.MonoSynth =>
    (bass ??= track(
      new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.005, decay: 0.15, sustain: 0.4, release: 0.08 },
        filterEnvelope: {
          attack: 0.005,
          decay: 0.12,
          sustain: 0.2,
          release: 0.1,
          baseFrequency: 120,
          octaves: 3,
        },
        volume: vol.MUSIC_BASS,
      }).connect(destination),
    ));

  const getKick = (): Tone.MembraneSynth =>
    (kick ??= track(
      new Tone.MembraneSynth({
        pitchDecay: 0.04,
        octaves: 5,
        envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.1 },
        volume: vol.MUSIC_KICK,
      }).connect(destination),
    ));

  const getSnare = (): Tone.NoiseSynth => {
    if (snare === null) {
      const filter = track(new Tone.Filter(1800, 'bandpass').connect(destination));
      snare = track(
        new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
          volume: vol.MUSIC_SNARE,
        }).connect(filter),
      );
    }
    return snare;
  };

  const getHat = (): Tone.NoiseSynth => {
    if (hat === null) {
      const filter = track(new Tone.Filter(7000, 'highpass').connect(destination));
      hat = track(
        new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
          volume: vol.MUSIC_HAT,
        }).connect(filter),
      );
    }
    return hat;
  };

  const getPad = (): Tone.PolySynth => {
    if (pad === null) {
      const filter = track(new Tone.Filter(900, 'lowpass').connect(destination));
      pad = track(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 0.08, decay: 0.2, sustain: 0.6, release: 0.4 },
          volume: vol.MUSIC_PAD,
        }).connect(filter),
      );
    }
    return pad;
  };

  const getLead = (): Tone.Synth => {
    if (lead === null) {
      const vibrato = track(new Tone.Vibrato(5.5, 0.15).connect(destination));
      lead = track(
        new Tone.Synth({
          oscillator: { type: 'sine' },
          portamento: 0.06,
          envelope: { attack: 0.06, decay: 0.1, sustain: 0.8, release: 0.2 },
          volume: vol.MUSIC_LEAD,
        }).connect(vibrato),
      );
    }
    return lead;
  };

  const getBell = (): Tone.FMSynth =>
    (bell ??= track(
      new Tone.FMSynth({
        harmonicity: 3.01,
        modulationIndex: 12,
        envelope: { attack: 0.001, decay: 0.8, sustain: 0, release: 0.6 },
        modulationEnvelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.4 },
        volume: vol.MUSIC_BELL,
      }).connect(destination),
    ));

  const getLaugh = (): Tone.NoiseSynth => {
    if (laugh === null) {
      const tremolo = track(new Tone.Tremolo(9, 0.9).connect(destination).start());
      const filter = track(new Tone.Filter(700, 'bandpass', -12).connect(tremolo));
      laugh = track(
        new Tone.NoiseSynth({
          noise: { type: 'pink' },
          envelope: { attack: 0.02, decay: 0.5, sustain: 0.3, release: 0.2 },
          volume: vol.MUSIC_LAUGH,
        }).connect(filter),
      );
    }
    return laugh;
  };

  return {
    play(e: Readonly<MusicEvent>, time: number, beatSeconds: number): void {
      // Note en retard (onglet en arrière-plan) : ne pas la rejouer.
      if (time < Tone.now()) return;
      const dur = Math.max(0.01, e.durationBeats * beatSeconds);
      const v = e.velocity;
      const hz = e.midi > 0 ? Tone.Frequency(e.midi, 'midi').toFrequency() : 0;
      switch (e.voice) {
        case 'kick':
          getKick().triggerAttackRelease(Tone.Frequency('C1').toFrequency(), dur, time, v);
          break;
        case 'snare':
          getSnare().triggerAttackRelease(dur, time, v);
          break;
        case 'hat':
          getHat().triggerAttackRelease(dur, time, v);
          break;
        case 'bass':
          getBass().triggerAttackRelease(hz, dur, time, v);
          break;
        case 'pad':
          getPad().triggerAttackRelease(hz, dur, time, v);
          break;
        case 'lead':
          getLead().triggerAttackRelease(hz, dur, time, v);
          break;
        case 'bell':
          getBell().triggerAttackRelease(hz, dur, time, v);
          break;
        case 'laugh':
          getLaugh().triggerAttackRelease(dur, time, v);
          break;
      }
    },
    stopAll(): void {
      // Libérer les instruments annule aussi les notes déjà planifiées ; ils sont recréés à la demande.
      for (const node of created.splice(0)) node.dispose();
      bass = kick = snare = hat = pad = lead = bell = laugh = null;
    },
  };
}
