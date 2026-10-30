import { Box3, InstancedMesh, Matrix4, Mesh, Sprite, Vector3 } from 'three';
import type { BufferGeometry, Light, Material, Object3D } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONFIG } from '../../src/config/game.config';
import { RENDER_CONFIG } from '../../src/config/render.config';
import { createEventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { acquire, obstacleRects } from '../../src/game/obstacles';
import type { RectPair } from '../../src/game/obstacles';
import { createWorld } from '../../src/game/state';
import type { World } from '../../src/game/state';
import { createRenderScene } from '../../src/render/scene';

const { HITBOX_ALIGN_TOLERANCE: TOL, MAX_DRAW_CALLS, MAX_TRIANGLES } = RENDER_CONFIG;
const { FLOOR, CEILING } = GAME_CONFIG.WORLD;

function makeWorld(): World {
  const world = createWorld({ seed: 1, muted: false, bus: createEventBus<GameEvents>() });
  world.phase = 'Playing';
  return world;
}

function collect(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) out.push(o);
  });
  return out;
}

function materialsOf(mesh: Mesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function boxOf(mesh: Mesh): Box3 {
  mesh.updateWorldMatrix(true, false);
  return new Box3().setFromObject(mesh);
}

function instanceBox(mesh: InstancedMesh, index: number): Box3 {
  mesh.geometry.computeBoundingBox();
  const m = new Matrix4();
  mesh.getMatrixAt(index, m);
  return (mesh.geometry.boundingBox as Box3).clone().applyMatrix4(m);
}

describe('scène complète', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('se construit et se met à jour sans WebGL en environnement node (9.6)', () => {
    const rs = createRenderScene({ world: makeWorld() });
    expect(() => {
      rs.resize(1280, 720);
      rs.update(0.5, 0.016);
    }).not.toThrow();
    rs.dispose();
  });

  it('contient exactement une lumière qui projette des ombres (7.2)', () => {
    const rs = createRenderScene({ world: makeWorld() });
    const casters: Light[] = [];
    rs.scene.traverse((o) => {
      const light = o as Light;
      if (light.isLight === true && light.castShadow) casters.push(light);
    });
    expect(casters).toHaveLength(1);
    rs.dispose();
  });

  it('reçoit des ombres sur le sol, le plafond et le receveur (7.3)', () => {
    const rs = createRenderScene({ world: makeWorld() });
    const receivers = collect(rs.scene).filter((m) => m.receiveShadow);
    expect(receivers.some((m) => m.name === 'shadow-receiver')).toBe(true);
    expect(receivers.length).toBeGreaterThanOrEqual(3);
    rs.dispose();
  });

  it('n\'utilise aucun matériau avec une texture `map` (9.7)', () => {
    const rs = createRenderScene({ world: makeWorld() });
    for (const mesh of collect(rs.scene)) {
      for (const material of materialsOf(mesh)) {
        expect((material as { map?: unknown }).map ?? null).toBeNull();
      }
    }
    rs.dispose();
  });

  it('utilise des InstancedMesh pour les Stèles et le décor (12.3)', () => {
    const rs = createRenderScene({ world: makeWorld() });
    const instanced = collect(rs.scene).filter((m): m is InstancedMesh => m instanceof InstancedMesh);
    const steleMeshes = instanced.filter((m) => m.instanceMatrix.count === 2 * GAME_CONFIG.POOL_SIZE);
    expect(steleMeshes.length).toBeGreaterThanOrEqual(3);
    // Stèles (3) + yeux + bras + au moins une couche de décor.
    expect(instanced.length).toBeGreaterThanOrEqual(steleMeshes.length + 1);
    rs.dispose();
  });

  it('aligne les boîtes de Kiro, Stèles, sol et plafond sur la collision (14.6)', () => {
    // Mouvement réduit : le bas du corps est immobile, l'enveloppe vaut exactement RADIUS.
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const world = makeWorld();
    world.kiro.x = 1.5;
    world.kiro.y = 0.7;
    world.kiro.prevY = 0.7;
    const o = acquire(world.pool);
    if (o === undefined) throw new Error('acquire a échoué');
    o.x = 2;
    o.prevX = 2;
    o.gapCenterY = (FLOOR + CEILING) / 2 + 0.3;

    const rs = createRenderScene({ world });
    rs.resize(1280, 720);
    rs.update(1, 0);
    rs.scene.updateMatrixWorld(true);

    const meshes = collect(rs.scene);

    // Kiro : seul Mesh non instancié, hors sol/plafond, qui projette une ombre.
    const body = meshes.find((m) => !(m instanceof InstancedMesh) && m.castShadow);
    if (body === undefined) throw new Error('corps de Kiro introuvable');
    const kBox = boxOf(body);
    const r = GAME_CONFIG.KIRO.RADIUS;
    expect(Math.abs((kBox.max.x - kBox.min.x) / 2 - r)).toBeLessThanOrEqual(TOL);
    expect(Math.abs((kBox.max.y - kBox.min.y) / 2 - r)).toBeLessThanOrEqual(TOL);
    expect(Math.abs((kBox.max.x + kBox.min.x) / 2 - world.kiro.x)).toBeLessThanOrEqual(TOL);
    expect(Math.abs((kBox.max.y + kBox.min.y) / 2 - world.kiro.y)).toBeLessThanOrEqual(TOL);

    // Stèles : union corps + chapiteau de l'instance = rectangle de collision.
    const instanced = meshes.filter((m): m is InstancedMesh => m instanceof InstancedMesh);
    const stele = instanced.filter((m) => m.castShadow && m.count === 2 * GAME_CONFIG.POOL_SIZE);
    expect(stele).toHaveLength(2); // corps et chapiteau
    const rects: RectPair = {
      top: { left: 0, right: 0, bottom: 0, top: 0 },
      bottom: { left: 0, right: 0, bottom: 0, top: 0 },
    };
    obstacleRects(o, rects);
    const pairs = [
      [0, rects.bottom],
      [1, rects.top],
    ] as const;
    for (const [index, rect] of pairs) {
      const union = new Box3();
      for (const m of stele) union.union(instanceBox(m, index));
      expect(Math.abs(union.min.x - rect.left)).toBeLessThanOrEqual(TOL);
      expect(Math.abs(union.max.x - rect.right)).toBeLessThanOrEqual(TOL);
      expect(Math.abs(union.min.y - rect.bottom)).toBeLessThanOrEqual(TOL);
      expect(Math.abs(union.max.y - rect.top)).toBeLessThanOrEqual(TOL);
      expect(Math.abs(union.max.z)).toBeLessThanOrEqual(TOL);
    }

    // Sol et plafond : maillages non instanciés qui reçoivent des ombres, hors receveur.
    const bounds = meshes.filter(
      (m) => !(m instanceof InstancedMesh) && m.receiveShadow && m.name !== 'shadow-receiver',
    );
    const floor = bounds.find((m) => boxOf(m).max.y <= FLOOR + TOL);
    const ceiling = bounds.find((m) => boxOf(m).min.y >= CEILING - TOL);
    if (floor === undefined || ceiling === undefined) throw new Error('sol ou plafond introuvable');
    expect(Math.abs(boxOf(floor).max.y - FLOOR)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(boxOf(ceiling).min.y - CEILING)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(boxOf(floor).max.z)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(boxOf(ceiling).max.z)).toBeLessThanOrEqual(TOL);

    rs.dispose();
  });

  it('dispose déclenche l\'événement dispose de chaque géométrie et matériau (9.5)', () => {
    const rs = createRenderScene({ world: makeWorld() });
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    for (const mesh of collect(rs.scene)) {
      geometries.add(mesh.geometry);
      for (const m of materialsOf(mesh)) materials.add(m);
    }
    const disposedG = new Set<BufferGeometry>();
    const disposedM = new Set<Material>();
    for (const g of geometries) g.addEventListener('dispose', () => disposedG.add(g));
    for (const m of materials) m.addEventListener('dispose', () => disposedM.add(m));

    rs.dispose();

    expect(geometries.size).toBeGreaterThan(0);
    expect(materials.size).toBeGreaterThan(0);
    expect(disposedG.size).toBe(geometries.size);
    expect(disposedM.size).toBe(materials.size);
  });
});

describe('fantôme en volume dans la scène (1.1, 1.2, 1.6, 1.7, 1.8, 2.1)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function ghostBody(root: Object3D): Mesh {
    const body = collect(root).find((m) => !(m instanceof InstancedMesh) && m.castShadow);
    if (body === undefined) throw new Error('corps de Kiro introuvable');
    return body;
  }

  it('ne contient aucun Sprite (2.1)', () => {
    const rs = createRenderScene({ world: makeWorld() });
    rs.update(0.5, 0.016);
    let sprites = 0;
    rs.scene.traverse((o) => {
      if (o instanceof Sprite) sprites++;
    });
    expect(sprites).toBe(0);
    rs.dispose();
  });

  it('le corps du fantôme projette une ombre (1.2)', () => {
    const rs = createRenderScene({ world: makeWorld() });
    expect(ghostBody(rs.scene).castShadow).toBe(true);
    rs.dispose();
  });

  it('l\'enveloppe du corps reste <= KIRO.RADIUS en mouvement réduit et en mouvement (1.7, 1.8)', () => {
    const radius = GAME_CONFIG.KIRO.RADIUS;
    const worstDistance = (mesh: Mesh): number => {
      const pos = mesh.geometry.getAttribute('position');
      const v = new Vector3();
      let max = 0;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        max = Math.max(max, Math.hypot(v.x, v.y));
      }
      return max;
    };

    for (const reduced of [true, false]) {
      vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
      const rs = createRenderScene({ world: makeWorld() });
      for (const now of [0, 0.3, 0.77, 1.9]) rs.update(1, now);
      const body = ghostBody(rs.scene);
      const tolerance = reduced ? TOL : RENDER_CONFIG.KIRO.HEM.AMPLITUDE + TOL;
      expect(worstDistance(body)).toBeLessThanOrEqual(radius + tolerance);
      rs.dispose();
    }
  });

  it('respecte MAX_DRAW_CALLS et MAX_TRIANGLES avec le fantôme en volume (1.6)', () => {
    const world = makeWorld();
    for (let i = 0; i < GAME_CONFIG.POOL_SIZE; i++) {
      const o = acquire(world.pool);
      if (o === undefined) throw new Error('acquire a échoué');
      o.x = i;
      o.prevX = i;
      o.gapCenterY = (FLOOR + CEILING) / 2;
    }
    const rs = createRenderScene({ world });
    rs.resize(1280, 720);
    rs.update(0.5, 0.016);

    const meshes = collect(rs.scene).filter((m) => m.visible);
    const draws = meshes.length + meshes.filter((m) => m.castShadow).length;
    const tris = meshes.reduce((n, m) => {
      const g = m.geometry;
      const per = g.index !== null ? g.index.count : (g.attributes.position?.count ?? 0);
      return n + (per / 3) * (m instanceof InstancedMesh ? m.count : 1);
    }, 0);
    expect(draws).toBeLessThanOrEqual(MAX_DRAW_CALLS);
    expect(tris).toBeLessThanOrEqual(MAX_TRIANGLES);
    rs.dispose();
  });
});