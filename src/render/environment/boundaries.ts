import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three';
import { GAME_CONFIG } from '../../config/game.config';
import { PALETTE } from '../../config/palette';
import { RENDER_CONFIG } from '../../config/render.config';

const WORLD = GAME_CONFIG.WORLD;
const { THICKNESS, DEPTH } = RENDER_CONFIG.BOUNDARY;

export interface Boundaries {
  readonly floor: Mesh;
  readonly ceiling: Mesh;
  /** Fixe la demi-largeur totale (échelle en x), centrée sur la Zone_Jeu. */
  setHalfWidth(halfWidth: number): void;
  dispose(): void;
}

/** Sol et plafond : deux boîtes partageant une géométrie, face avant sur z = 0. */
export function createBoundaries(): Boundaries {
  // Boîte unitaire translatée : z dans [-1, 0] (face avant sur z = 0).
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.translate(0, 0, -0.5);

  const floorMaterial = new MeshStandardMaterial({ color: PALETTE.FLOOR });
  const ceilingMaterial = new MeshStandardMaterial({ color: PALETTE.CEILING });

  const centerX = (WORLD.LEFT + WORLD.RIGHT) / 2;
  const halfZone = (WORLD.RIGHT - WORLD.LEFT) / 2;

  const floor = new Mesh(geometry, floorMaterial);
  floor.name = 'floor';
  // Occupe [FLOOR - THICKNESS, FLOOR] : bord intérieur (face supérieure) à FLOOR.
  floor.position.set(centerX, WORLD.FLOOR - THICKNESS / 2, 0);

  const ceiling = new Mesh(geometry, ceilingMaterial);
  ceiling.name = 'ceiling';
  // Occupe [CEILING, CEILING + THICKNESS] : bord intérieur (face inférieure) à CEILING.
  ceiling.position.set(centerX, WORLD.CEILING + THICKNESS / 2, 0);

  for (const mesh of [floor, ceiling]) {
    mesh.receiveShadow = true;
    mesh.scale.set(2 * halfZone, THICKNESS, DEPTH);
  }

  return {
    floor,
    ceiling,
    setHalfWidth(halfWidth: number): void {
      const width = 2 * halfWidth;
      floor.scale.x = width;
      ceiling.scale.x = width;
    },
    dispose(): void {
      geometry.dispose();
      floorMaterial.dispose();
      ceilingMaterial.dispose();
    },
  };
}
