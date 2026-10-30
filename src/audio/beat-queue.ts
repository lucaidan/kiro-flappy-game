import type { BeatEvent } from './timing/beat-math';

export interface BeatQueue {
  /** Insertion triée par audioTime ; si plein, supprime le plus ancien. */
  push(e: BeatEvent): void;
  /** Retire et copie dans `out` les événements échus (audioTime <= audioNow), ordre croissant. */
  drainDue(audioNow: number, out: BeatEvent[]): number;
  /** Retire les événements avec audioTime < audioNow - maxLateness. */
  purgeStale(audioNow: number, maxLateness: number): void;
  clear(): void;
  readonly size: number;
}

/** Crée une file bornée à tampon préalloué, triée par audioTime croissant. */
export function createBeatQueue(capacity: number): BeatQueue {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError(`beat queue capacity must be a positive integer, got ${capacity}`);
  }
  const buf: (BeatEvent | undefined)[] = new Array<BeatEvent | undefined>(capacity).fill(undefined);
  let count = 0;

  /** Retire les `n` premiers éléments (les plus anciens). */
  const removeFront = (n: number): void => {
    if (n <= 0) return;
    for (let i = n; i < count; i++) buf[i - n] = buf[i];
    for (let i = count - n; i < count; i++) buf[i] = undefined;
    count -= n;
  };

  return {
    push(e: BeatEvent): void {
      if (count === capacity) removeFront(1);
      // insertion après les éléments de même audioTime (stable)
      let i = count;
      while (i > 0 && (buf[i - 1] as BeatEvent).audioTime > e.audioTime) {
        buf[i] = buf[i - 1];
        i--;
      }
      buf[i] = e;
      count++;
    },
    drainDue(audioNow: number, out: BeatEvent[]): number {
      let n = 0;
      while (n < count && (buf[n] as BeatEvent).audioTime <= audioNow) {
        out.push(buf[n] as BeatEvent);
        n++;
      }
      removeFront(n);
      return n;
    },
    purgeStale(audioNow: number, maxLateness: number): void {
      const limit = audioNow - maxLateness;
      let n = 0;
      while (n < count && (buf[n] as BeatEvent).audioTime < limit) n++;
      removeFront(n);
    },
    clear(): void {
      for (let i = 0; i < count; i++) buf[i] = undefined;
      count = 0;
    },
    get size(): number {
      return count;
    },
  };
}
