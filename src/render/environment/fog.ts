import { Fog } from 'three';
import { PALETTE } from '../../config/palette';
import { RENDER_CONFIG } from '../../config/render.config';

/** Crée le brouillard de la scène (couleur de la Palette, bornes à ajuster via updateFog). */
export function createFog(): Fog {
  const cfg = RENDER_CONFIG.FOG;
  return new Fog(PALETTE.FOG, cfg.NEAR_OFFSET, cfg.FAR_OFFSET);
}

/** near = distance + FOG.NEAR_OFFSET ; far = distance + FOG.FAR_OFFSET. */
export function updateFog(fog: Fog, distance: number): void {
  const cfg = RENDER_CONFIG.FOG;
  fog.near = distance + cfg.NEAR_OFFSET;
  fog.far = distance + cfg.FAR_OFFSET;
}
