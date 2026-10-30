/**
 * RNG à graine (mulberry32). Pur et déterministe : n'utilise ni Math.random
 * ni l'horloge (exigence 2.8).
 */

export interface Rng {
  readonly initialSeed: number;
  /** Flottant dans [0, 1[. */
  next(): number;
  /** Flottant dans [min, max[ (min < max). */
  float(min: number, max: number): number;
  /** Entier dans [min, max] (min <= max). */
  int(min: number, max: number): number;
  /** Retour à la graine initiale. */
  reset(): void;
  /** État interne uint32 (tests de pause, débogage). */
  getState(): number;
}

const ERR_BOUNDS = 'bornes invalides';
const ERR_NO_SOURCE = 'source de graine absente';

function toUint32(value: number): number {
  return Math.trunc(Number.isFinite(value) ? value : 0) >>> 0;
}

export function createRng(seed: number): Rng {
  const initialSeed = toUint32(seed);
  let state = initialSeed;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    initialSeed,
    next,
    float(min: number, max: number): number {
      if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
        throw new Error(ERR_BOUNDS);
      }
      return min + next() * (max - min);
    },
    int(min: number, max: number): number {
      if (
        !Number.isFinite(min) ||
        !Number.isFinite(max) ||
        min > max ||
        !Number.isInteger(min) ||
        !Number.isInteger(max)
      ) {
        throw new Error(ERR_BOUNDS);
      }
      return min + Math.floor(next() * (max - min + 1));
    },
    reset(): void {
      state = initialSeed;
    },
    getState(): number {
      return state;
    },
  };
}

export function createRngFromSource(source?: () => number): Rng {
  if (typeof source !== 'function') {
    throw new Error(ERR_NO_SOURCE);
  }
  return createRng(toUint32(source()));
}
