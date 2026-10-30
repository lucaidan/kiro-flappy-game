import { DirectionalLight, HemisphereLight, PointLight } from 'three';
import type { Scene } from 'three';
import { PALETTE } from '../config/palette';
import { RENDER_CONFIG } from '../config/render.config';

export interface LightRig {
  readonly hemisphere: HemisphereLight;
  /** Lumière_Principale : seule à projeter des ombres. */
  readonly main: DirectionalLight;
  /** Suit la position dessinée de Kiro. */
  readonly kiro: PointLight;
}

/** Crée les trois lumières ; tout est constant sauf la position de la lumière de Kiro. */
export function createLights(): LightRig {
  const cfg = RENDER_CONFIG.LIGHT;
  const sh = RENDER_CONFIG.SHADOW;

  const hemisphere = new HemisphereLight(
    PALETTE.LIGHT_HEMI_SKY,
    PALETTE.LIGHT_HEMI_GROUND,
    cfg.HEMI_INTENSITY,
  );

  const main = new DirectionalLight(PALETTE.LIGHT_MOON, cfg.MAIN_INTENSITY);
  main.position.set(cfg.MAIN_POSITION.x, cfg.MAIN_POSITION.y, cfg.MAIN_POSITION.z);
  main.castShadow = true;
  main.shadow.mapSize.set(sh.MAP_SIZE, sh.MAP_SIZE);
  const cam = main.shadow.camera;
  cam.left = -sh.CAMERA_HALF;
  cam.right = sh.CAMERA_HALF;
  cam.top = sh.CAMERA_HALF;
  cam.bottom = -sh.CAMERA_HALF;
  cam.near = sh.NEAR;
  cam.far = sh.FAR;
  cam.updateProjectionMatrix();
  main.shadow.bias = sh.BIAS;
  main.shadow.normalBias = sh.NORMAL_BIAS;

  const kiro = new PointLight(
    PALETTE.KIRO_LIGHT,
    cfg.KIRO_INTENSITY,
    cfg.KIRO_DISTANCE,
    cfg.KIRO_DECAY,
  );
  kiro.castShadow = false;

  return { hemisphere, main, kiro };
}

/** Ajoute les lumières (et la cible de la principale) à la scène. */
export function addLights(scene: Scene, rig: LightRig): void {
  scene.add(rig.hemisphere, rig.main, rig.main.target, rig.kiro);
}

/** Place la lumière de Kiro devant le corps, sans autre changement. */
export function updateKiroLight(rig: LightRig, x: number, y: number): void {
  rig.kiro.position.set(x, y, RENDER_CONFIG.LIGHT.KIRO_OFFSET_Z);
}
