import { Box3, type Mesh, type MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../../src/config/game.config';
import { PALETTE } from '../../src/config/palette';
import { RENDER_CONFIG } from '../../src/config/render.config';
import { createBoundaries } from '../../src/render/environment/boundaries';

const WORLD = GAME_CONFIG.WORLD;
const TOL = RENDER_CONFIG.HITBOX_ALIGN_TOLERANCE;

function boxOf(mesh: Mesh): Box3 {
  mesh.updateMatrixWorld(true);
  return new Box3().setFromObject(mesh);
}

describe('boundaries', () => {
  it('place le bord intérieur du sol à WORLD.FLOOR', () => {
    const { floor } = createBoundaries();
    expect(Math.abs(boxOf(floor).max.y - WORLD.FLOOR)).toBeLessThanOrEqual(TOL);
  });

  it('place le bord intérieur du plafond à WORLD.CEILING', () => {
    const { ceiling } = createBoundaries();
    expect(Math.abs(boxOf(ceiling).min.y - WORLD.CEILING)).toBeLessThanOrEqual(TOL);
  });

  it('place la face avant du sol et du plafond sur z = 0', () => {
    const { floor, ceiling } = createBoundaries();
    expect(Math.abs(boxOf(floor).max.z)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(boxOf(ceiling).max.z)).toBeLessThanOrEqual(TOL);
  });

  it('utilise les couleurs de la Palette', () => {
    const { floor, ceiling } = createBoundaries();
    expect((floor.material as MeshStandardMaterial).color.getHex()).toBe(PALETTE.FLOOR);
    expect((ceiling.material as MeshStandardMaterial).color.getHex()).toBe(PALETTE.CEILING);
  });

  it('dépasse la couverture après setHalfWidth', () => {
    const boundaries = createBoundaries();
    const halfWidth = 30;
    boundaries.setHalfWidth(halfWidth);
    for (const mesh of [boundaries.floor, boundaries.ceiling]) {
      const box = boxOf(mesh);
      expect(box.max.x - box.min.x).toBeGreaterThanOrEqual(2 * halfWidth);
    }
  });
});
