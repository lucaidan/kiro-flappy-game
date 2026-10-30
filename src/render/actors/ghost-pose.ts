import { RENDER_CONFIG } from '../../config/render.config';
import type { GhostClip } from './ghost-sprite-frames';

const { ARM, HEM, DISSIPATE } = RENDER_CONFIG.KIRO;

/** Pose du fantôme : tampon unique réutilisé. */
export interface GhostPose {
  /** Angle d'épaule (rad) : bas au flottement, haut au battement. */
  armAngle: number;
  /** Balancement des bras (rad). */
  armSway: number;
  /** Amplitude du bas ondulant ; 0 en mouvement réduit. */
  hemAmplitude: number;
  /** Opacité dans [0, 1]. */
  opacity: number;
  /** Échelle >= 1 (élargissement en dissipation). */
  scale: number;
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** Pose pure selon le clip et le temps de clip (secondes). */
export function computeGhostPose(
  clip: GhostClip,
  clipTime: number,
  reducedMotion: boolean,
  out: GhostPose,
): GhostPose {
  const t = Math.max(0, finiteOrZero(clipTime));
  out.hemAmplitude = reducedMotion ? 0 : HEM.AMPLITUDE;
  out.armSway = reducedMotion ? 0 : ARM.SWAY * Math.sin(2 * Math.PI * ARM.SWAY_HZ * t);
  out.armAngle = clip === 'flap' ? ARM.ANGLE_UP : ARM.ANGLE_DOWN;
  if (clip === 'dissipate') {
    const k = Math.min(t / DISSIPATE.DURATION, 1);
    out.opacity = 1 - k;
    out.scale = 1 + (DISSIPATE.SCALE_END - 1) * k;
  } else {
    out.opacity = 1;
    out.scale = 1;
  }
  return out;
}

/** Déplacement vertical d'un sommet du bas : borné par ±amplitude. */
export function hemOffset(angle: number, wobbleTime: number, amplitude: number): number {
  const a = Math.abs(finiteOrZero(amplitude));
  if (a === 0) return 0;
  const phase =
    HEM.LOBES * finiteOrZero(angle) + 2 * Math.PI * HEM.FREQUENCY_HZ * finiteOrZero(wobbleTime);
  return a * Math.sin(phase);
}
