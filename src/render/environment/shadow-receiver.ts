import { Mesh, PlaneGeometry, ShadowMaterial } from 'three';
import { GAME_CONFIG } from '../../config/game.config';
import { PALETTE } from '../../config/palette';
import { RENDER_CONFIG } from '../../config/render.config';

const WORLD = GAME_CONFIG.WORLD;
const MARGIN = RENDER_CONFIG.VIEW_MARGIN;

/** Plan `ShadowMaterial` en z = SHADOW.RECEIVER_Z, receveur d'ombres uniquement. */
export function createShadowReceiver(): Mesh {
  const width = WORLD.RIGHT - WORLD.LEFT + 2 * MARGIN;
  const height = WORLD.CEILING - WORLD.FLOOR + 2 * MARGIN;
  const material = new ShadowMaterial({
    color: PALETTE.SHADOW,
    opacity: RENDER_CONFIG.SHADOW.OPACITY,
  });
  const mesh = new Mesh(new PlaneGeometry(width, height), material);
  mesh.position.set(
    (WORLD.LEFT + WORLD.RIGHT) / 2,
    (WORLD.FLOOR + WORLD.CEILING) / 2,
    RENDER_CONFIG.SHADOW.RECEIVER_Z,
  );
  mesh.receiveShadow = true;
  mesh.name = 'shadow-receiver';
  return mesh;
}
