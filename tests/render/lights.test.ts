import { DirectionalLight, HemisphereLight, PointLight, Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { RENDER_CONFIG } from '../../src/config/render.config';
import { addLights, createLights, updateKiroLight } from '../../src/render/lights';

describe('lights', () => {
  it('crée les lumières hémisphère, principale et ponctuelle (7.1)', () => {
    const rig = createLights();
    expect(rig.hemisphere).toBeInstanceOf(HemisphereLight);
    expect(rig.main).toBeInstanceOf(DirectionalLight);
    expect(rig.kiro).toBeInstanceOf(PointLight);
  });

  it('une seule lumière projette des ombres (7.2)', () => {
    const scene = new Scene();
    addLights(scene, createLights());
    const casters: unknown[] = [];
    scene.traverse((o) => {
      if ((o as { isLight?: boolean }).isLight && (o as { castShadow?: boolean }).castShadow) {
        casters.push(o);
      }
    });
    expect(casters).toHaveLength(1);
    expect(casters[0]).toBeInstanceOf(DirectionalLight);
  });

  it("la carte d'ombre ne dépasse pas SHADOW_MAP_SIZE_MAX (7.3)", () => {
    const { main } = createLights();
    const max = RENDER_CONFIG.SHADOW_MAP_SIZE_MAX;
    expect(main.shadow.mapSize.x).toBeLessThanOrEqual(max);
    expect(main.shadow.mapSize.y).toBeLessThanOrEqual(max);
  });

  it('updateKiroLight ne change que la position (7.6)', () => {
    const rig = createLights();
    const before = {
      hemi: rig.hemisphere.intensity,
      main: rig.main.intensity,
      kiro: rig.kiro.intensity,
    };
    updateKiroLight(rig, 1.5, -2);
    expect(rig.hemisphere.intensity).toBe(before.hemi);
    expect(rig.main.intensity).toBe(before.main);
    expect(rig.kiro.intensity).toBe(before.kiro);
    expect(rig.kiro.position.x).toBe(1.5);
    expect(rig.kiro.position.y).toBe(-2);
    expect(rig.kiro.position.z).toBe(RENDER_CONFIG.LIGHT.KIRO_OFFSET_Z);
  });
});
