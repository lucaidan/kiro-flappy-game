import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../src/config/palette';
import { RENDER_CONFIG } from '../../src/config/render.config';
import { createFog, updateFog } from '../../src/render/environment/fog';

describe('fog', () => {
  it('utilise la couleur FOG de la palette', () => {
    expect(createFog().color.getHex()).toBe(PALETTE.FOG);
  });

  it('createFog applique les décalages near et far', () => {
    const fog = createFog();
    expect(fog.near).toBe(RENDER_CONFIG.FOG.NEAR_OFFSET);
    expect(fog.far).toBe(RENDER_CONFIG.FOG.FAR_OFFSET);
  });

  it('updateFog place near et far relativement à la distance', () => {
    const fog = createFog();
    updateFog(fog, 12);
    expect(fog.near).toBe(12 + RENDER_CONFIG.FOG.NEAR_OFFSET);
    expect(fog.far).toBe(12 + RENDER_CONFIG.FOG.FAR_OFFSET);
  });

  it('fog.near est supérieur à la distance de la caméra au Plan_Jeu (7.4)', () => {
    const fog = createFog();
    updateFog(fog, 20);
    expect(fog.near).toBeGreaterThan(20);
    expect(fog.far).toBeGreaterThan(fog.near);
  });
});
