import { describe, it, expect } from 'vitest';
import { Color, Matrix4, MeshStandardMaterial, Vector3, type BufferGeometry, type Material } from 'three';
import type { InstancedMesh } from 'three';
import { GAME_CONFIG } from '../../src/config/game.config';
import { PALETTE } from '../../src/config/palette';
import { createPool, acquire } from '../../src/game/obstacles';
import { createTombstones } from '../../src/render/actors/tombstones';

const POOL_SIZE = GAME_CONFIG.POOL_SIZE;

function scaleOf(mesh: InstancedMesh, index: number): Vector3 {
  const m = new Matrix4();
  mesh.getMatrixAt(index, m);
  return new Vector3().setFromMatrixScale(m);
}

describe('Stèles', () => {
  it('chaque maillage contient 2 × POOL_SIZE instances (4.2)', () => {
    const t = createTombstones(POOL_SIZE);
    expect(t.bodies.count).toBe(2 * POOL_SIZE);
    expect(t.caps.count).toBe(2 * POOL_SIZE);
    expect(t.rims.count).toBe(2 * POOL_SIZE);
    t.dispose();
  });

  it('la couleur du liseré provient de la Palette (4.5)', () => {
    const t = createTombstones(POOL_SIZE);
    const material = t.rims.material as MeshStandardMaterial;
    expect(material.color.getHex()).toBe(PALETTE.STELE_RIM);
    // Corps et chapiteaux : couleur par instance (parité du Slot).
    const c = new Color();
    t.bodies.getColorAt(0, c);
    expect(c.getHex()).toBe(PALETTE.STELE_BODY);
    t.bodies.getColorAt(2, c);
    expect(c.getHex()).toBe(PALETTE.DEAD_WOOD);
    t.caps.getColorAt(0, c);
    expect(c.getHex()).toBe(PALETTE.STELE_CAP);
    t.dispose();
  });

  it('masque un Obstacle inactif par une échelle nulle sans retirer d\'instance (4.7)', () => {
    const t = createTombstones(POOL_SIZE);
    const pool = createPool(POOL_SIZE);
    const o = acquire(pool);
    if (o === undefined) throw new Error('acquire a échoué');
    o.gapCenterY = (GAME_CONFIG.WORLD.FLOOR + GAME_CONFIG.WORLD.CEILING) / 2;

    t.update(pool, 1);
    // Obstacle 0 actif : corps visibles.
    expect(scaleOf(t.bodies, 0).length()).toBeGreaterThan(0);
    expect(scaleOf(t.bodies, 1).length()).toBeGreaterThan(0);

    o.active = false;
    t.update(pool, 1);

    for (const mesh of [t.bodies, t.caps, t.rims]) {
      expect(mesh.count).toBe(2 * POOL_SIZE);
      for (let i = 0; i < 2 * POOL_SIZE; i++) {
        expect(scaleOf(mesh, i).length()).toBe(0);
      }
    }
    t.dispose();
  });

  it('dispose libère les géométries et les matériaux (9.5)', () => {
    const t = createTombstones(POOL_SIZE);
    const meshes = [t.bodies, t.caps, t.rims];
    const geometries = new Set<BufferGeometry>(meshes.map((m) => m.geometry));
    const materials = new Set<Material>(meshes.map((m) => m.material as Material));
    const disposedG = new Set<BufferGeometry>();
    const disposedM = new Set<Material>();
    for (const g of geometries) g.addEventListener('dispose', () => disposedG.add(g));
    for (const m of materials) m.addEventListener('dispose', () => disposedM.add(m));

    t.dispose();

    expect(disposedG.size).toBe(geometries.size);
    expect(disposedM.size).toBe(materials.size);
    expect(materials.size).toBe(3);
  });
});
