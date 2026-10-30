import { RENDER_CONFIG } from '../config/render.config';

export interface AnimClock {
  time: number;
  lastNow: number;
  started: boolean;
}

export function createAnimClock(): AnimClock {
  return { time: 0, lastNow: 0, started: false };
}

/**
 * Avance l'horloge de `now - lastNow` (borné à [0, ANIM.MAX_DT]) seulement si
 * `running` est vrai. Retourne le temps d'animation en secondes.
 */
export function advanceAnimClock(
  clock: AnimClock,
  nowSeconds: number,
  running: boolean,
): number {
  if (!Number.isFinite(nowSeconds)) return clock.time;
  if (!clock.started) {
    clock.started = true;
    clock.lastNow = nowSeconds;
    return clock.time;
  }
  const dt = Math.min(Math.max(nowSeconds - clock.lastNow, 0), RENDER_CONFIG.ANIM.MAX_DT);
  clock.lastNow = nowSeconds;
  if (running) clock.time += dt;
  return clock.time;
}
