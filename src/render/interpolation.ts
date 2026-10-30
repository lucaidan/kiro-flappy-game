import type { GameStateName } from '../core/events';

/** Borne alpha à [0, 1] ; 0 si la valeur n'est pas un nombre fini (13.8). */
export function clampAlpha(alpha: number): number {
  if (typeof alpha !== 'number' || Number.isNaN(alpha)) return 0;
  if (alpha < 0) return 0;
  if (alpha > 1) return 1;
  return alpha;
}

/** `prev + (curr - prev) * clampAlpha(alpha)` (13.3). */
export function interpolate(prev: number, curr: number, alpha: number): number {
  return prev + (curr - prev) * clampAlpha(alpha);
}

/** Alpha utilisé pour le dessin : borné en Playing, 1 dans Title, Paused et GameOver (8.3, 8.4, 8.5). */
export function effectiveAlpha(phase: GameStateName, alpha: number): number {
  return phase === 'Playing' ? clampAlpha(alpha) : 1;
}
