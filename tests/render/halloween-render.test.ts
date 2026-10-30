import { Box3, InstancedMesh, Matrix4, Mesh } from 'three';
import type { Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../../src/config/game.config';
import { PALETTE } from '../../src/config/palette';
import { RENDER_CONFIG } from '../../src/config/render.config';
import { createEventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { acquire, obstacleRects } from '../../src/game/obstacles';
import type { RectPair } from '../../src/game/obstacles';
import { createWorld } from '../../src/game/state';
import type { World } from '../../src/game/state';
import { contrastRatio } from '../../src/render/contrast';
import { createRenderScene } from '../../src/render/scene';

const { CONTRAST_MIN, MAX_DRAW_CALLS, MAX_TRIANGLES, HITBOX_ALIGN_TOLERANCE: TOL } = RENDER_CONFIG;
const { FLOOR, CEILING } = GAME_CONFIG.WORLD;

const backgrounds = {
  BACKGROUND: PALETTE.BACKGROUND,
  DECOR_SKY: PALETTE.DECOR_SKY,
  DECOR_FAR: PALETTE.DECOR_FAR,
  DECOR_MID: PALETTE.DECOR_MID,
  FOG: PALETTE.FOG,
};

const obstacleColors = {
  [RENDER_CONFIG.OBSTACLE_THEME.EVEN]: PALETTE[RENDER_CONFIG.OBSTACLE_THEME.EVEN],
  [RENDER_CONFIG.OBSTACLE_THEME.ODD]: PALETTE[RENDER_CONFIG.OBSTACLE_THEME.ODD],
  STELE_CAP: PALETTE.STELE_CAP,
  GHOST_TINT: PALETTE.GHOST_TINT,
  KIRO: PALETTE.KIRO,
};

function makeWorld(): World {
  const world = createWorld({ seed: 1, muted: false, bus: createEventBus<GameEvents>() });
  world.phase = 'Playing';
  return world;
}

function meshesOf(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) out.push(o);
  });
  return out;
}

function triangles(mesh: Mesh): number {
  const g = mesh.geometry;
  const per = g.index !== null ? g.index.count : (g.attributes.position?.count ?? 0);
  const instances = mesh instanceof InstancedMesh ? mesh.count : 1;
  return (per / 3) * instances;
}

function instanceBox(mesh: InstancedMesh, index: number): Box3 {
  mesh.geometry.computeBoundingBox();
  const m = new Matrix4();
  mesh.getMatrixAt(index, m);
  return (mesh.geometry.boundingBox as Box3).clone().applyMatrix4(m);
}

describe('contraste Halloween (1.3)', () => {
  describe.each(Object.entries(obstacleColors))('%s', (_name, color) => {
    it.each(Object.entries(backgrounds))('contraste >= CONTRAST_MIN contre %s', (_bg, bg) => {
      expect(contrastRatio(color, bg)).toBeGreaterThanOrEqual(CONTRAST_MIN);
    });
  });
});

describe('budgets de rendu Halloween (2.4)', () => {
  it('respecte MAX_DRAW_CALLS et MAX_TRIANGLES avec obstacles actifs', () => {
    const world = makeWorld();
    for (let i = 0; i < GAME_CONFIG.POOL_SIZE; i++) {
      const o = acquire(world.pool);
      if (o === undefined) throw new Error('acquire a Ã©chouÃ©');
      o.x = i;
      o.prevX = i;
      o.gapCenterY = (FLOOR + CEILING) / 2;
    }
    const rs = createRenderScene({ world });
    rs.resize(1280, 720);
    rs.update(0.5, 0.016);

    const meshes = meshesOf(rs.scene).filter((m) => m.visible);
    // Passe principale + passe d'ombre des maillages qui projettent.
    const draws = meshes.length + meshes.filter((m) => m.castShadow).length;
    const tris = meshes.reduce((n, m) => n + triangles(m), 0);
    expect(draws).toBeLessThanOrEqual(MAX_DRAW_CALLS);
    expect(tris).toBeLessThanOrEqual(MAX_TRIANGLES);
    rs.dispose();
  });
});

describe('visages de citrouille (3.3)', () => {
  it('chaque visage est contenu dans le rectangle de collision de sa StÃ¨le', () => {
    const world = makeWorld();
    const placed = [];
    for (let slot = 0; slot < 2; slot++) {
      const o = acquire(world.pool);
      if (o === undefined) throw new Error('acquire a Ã©chouÃ©');
      o.x = 2 + 3 * slot;
      o.prevX = o.x;
      o.gapCenterY = (FLOOR + CEILING) / 2 + 0.3 * slot;
      placed.push(o);
    }
    const rs = createRenderScene({ world });
    rs.resize(1280, 720);
    rs.update(1, 0);
    rs.scene.updateMatrixWorld(true);

    const faces = meshesOf(rs.scene).find(
      (m): m is InstancedMesh =>
        m instanceof InstancedMesh &&
        !m.castShadow &&
        m.count === 2 * GAME_CONFIG.POOL_SIZE &&
        (m.material as { emissive?: { getHex(): number } }).emissive?.getHex() ===
          PALETTE.PUMPKIN_GLOW,
    );
    if (faces === undefined) throw new Error('visages introuvables');

    const rects: RectPair = {
      top: { left: 0, right: 0, bottom: 0, top: 0 },
      bottom: { left: 0, right: 0, bottom: 0, top: 0 },
    };
    placed.forEach((o, slot) => {
      obstacleRects(o, rects);
      const pairs = [
        [2 * slot, rects.bottom],
        [2 * slot + 1, rects.top],
      ] as const;
      for (const [index, r] of pairs) {
        const b = instanceBox(faces, index);
        expect(b.min.x).toBeGreaterThanOrEqual(r.left - TOL);
        expect(b.max.x).toBeLessThanOrEqual(r.right + TOL);
        expect(b.min.y).toBeGreaterThanOrEqual(r.bottom - TOL);
        expect(b.max.y).toBeLessThanOrEqual(r.top + TOL);
        // Sur la face avant, devant le plan z = 0.
        expect(b.max.z).toBeGreaterThan(0);
      }
    });
    rs.dispose();
  });
});

