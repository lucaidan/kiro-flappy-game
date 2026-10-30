import { ShadowMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { RENDER_CONFIG } from '../../src/config/render.config';
import { createShadowReceiver } from '../../src/render/environment/shadow-receiver';

describe('shadow receiver', () => {
  it('utilise un ShadowMaterial', () => {
    expect(createShadowReceiver().material).toBeInstanceOf(ShadowMaterial);
  });

  it('reçoit les ombres', () => {
    expect(createShadowReceiver().receiveShadow).toBe(true);
  });

  it('est placé derrière le Plan_Jeu (z < 0)', () => {
    const mesh = createShadowReceiver();
    expect(mesh.position.z).toBe(RENDER_CONFIG.SHADOW.RECEIVER_Z);
    expect(mesh.position.z).toBeLessThan(0);
  });
});
