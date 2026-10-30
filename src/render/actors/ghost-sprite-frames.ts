import { RENDER_CONFIG } from '../../config/render.config';
import type { GameStateName } from '../../core/events';

export type GhostClip = 'float' | 'flap' | 'dissipate';

/** Clip selon la phase et la vitesse verticale ; vy non fini ramené à 0. */
export function selectClip(phase: GameStateName, vy: number): GhostClip {
  if (phase === 'GameOver') return 'dissipate';
  const v = Number.isFinite(vy) ? vy : 0;
  if (v > RENDER_CONFIG.KIRO.FLAP_VY_THRESHOLD) return 'flap';
  return 'float';
}
