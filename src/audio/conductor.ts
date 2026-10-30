import { AUDIO_CONFIG } from '../config/audio.config';
import type { BeatQueue } from './beat-queue';
import { beatSeconds, type BeatEvent } from './timing/beat-math';

export interface TransportLike {
  scheduleRepeat(cb: (time: number) => void, interval: string, startTime?: number | string): number;
  start(time?: number | string): void;
  pause(time?: number | string): void;
  stop(time?: number | string): void;
  cancel(after?: number): void;
  bpm: { value: number };
}

export interface ToneApi {
  start(): Promise<void>;
  now(): number;
  transport(): TransportLike;
  setOutputMuted(m: boolean): void;
}

export interface Conductor {
  readonly queue: BeatQueue;
  /** Tone.start() ; en cas d'échec : état « indisponible » (l'erreur est relancée). */
  unlock(): Promise<void>;
  /** cancel, clear, beatIndex = 0, start. Mémorisé si appelé avant unlock(). */
  restart(): void;
  pause(): void;
  /** purgeStale puis start. */
  resume(): void;
  stop(): void;
  /** Abonnement aux temps (après push dans la file) ; retourne le désabonnement. */
  onBeat(cb: (e: BeatEvent) => void): () => void;
  /** Coupe la sortie ; le Transport continue. */
  setMuted(m: boolean): void;
  /** Transport démarré et contexte actif. */
  isRunning(): boolean;
  now(): number;
  readonly beatIndex: number;
  dispose(): void;
}

/** Crée le chef d'orchestre ; le callback de répétition ne fait que pousser dans la file. */
export function createConductor(tone: ToneApi, queue: BeatQueue): Conductor {
  let unlocked = false;
  let unavailable = false;
  let running = false;
  let restartPending = false;
  let disposed = false;
  let muted = false;
  let beatIndex = 0;
  const subscribers = new Set<(e: BeatEvent) => void>();

  const doRestart = (): void => {
    const transport = tone.transport();
    transport.stop();
    transport.cancel();
    queue.clear();
    beatIndex = 0;
    transport.bpm.value = AUDIO_CONFIG.BPM;
    transport.scheduleRepeat((time: number) => {
      const n = beatIndex++;
      const event: BeatEvent = {
        beatIndex: n,
        audioTime: time,
        pattern: n % AUDIO_CONFIG.BEATS_PER_BAR,
      };
      queue.push(event);
      for (const cb of [...subscribers]) cb(event);
    }, AUDIO_CONFIG.BEAT_NOTATION);
    transport.start();
    running = true;
  };

  return {
    queue,
    async unlock(): Promise<void> {
      if (disposed || unlocked) return;
      try {
        await tone.start();
      } catch (err) {
        unavailable = true;
        unlocked = false;
        running = false;
        restartPending = false;
        throw err;
      }
      if (disposed) return;
      unlocked = true;
      unavailable = false;
      tone.setOutputMuted(muted);
      if (restartPending) {
        restartPending = false;
        doRestart();
      }
    },
    restart(): void {
      if (disposed || unavailable) return;
      if (!unlocked) {
        restartPending = true;
        return;
      }
      doRestart();
    },
    pause(): void {
      restartPending = false;
      if (!unlocked || disposed) return;
      tone.transport().pause();
      running = false;
    },
    resume(): void {
      if (!unlocked || disposed) return;
      const transport = tone.transport();
      queue.purgeStale(
        tone.now(),
        AUDIO_CONFIG.MAX_LATENESS_BEATS * beatSeconds(transport.bpm.value),
      );
      transport.start();
      running = true;
    },
    stop(): void {
      restartPending = false;
      if (!unlocked || disposed) return;
      const transport = tone.transport();
      transport.stop();
      transport.cancel();
      running = false;
    },
    onBeat(cb: (e: BeatEvent) => void): () => void {
      if (disposed) return () => {};
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
    setMuted(m: boolean): void {
      muted = m;
      if (unlocked && !disposed) tone.setOutputMuted(m);
    },
    isRunning(): boolean {
      return running && unlocked && !unavailable && !disposed;
    },
    now(): number {
      return tone.now();
    },
    get beatIndex(): number {
      return beatIndex;
    },
    dispose(): void {
      if (disposed) return;
      if (unlocked) {
        const transport = tone.transport();
        transport.stop();
        transport.cancel();
      }
      running = false;
      restartPending = false;
      queue.clear();
      subscribers.clear();
      disposed = true;
    },
  };
}
