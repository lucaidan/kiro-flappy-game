import { describe, it, expect } from 'vitest';
import { Box3, BufferGeometry, InstancedMesh, Material, Mesh, type Object3D } from 'three';
import { createKiroGhost } from '../../src/render/actors/kiro-ghost';

const POSE = { clip: 'float', clipTime: 0, reducedMotion: false } as const;

/** Collecte les maillages (Mesh et InstancedMesh) du groupe. */
function collectMeshes(root: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) meshes.push(o);
  });
  return meshes;
}

function collectResources(root: Object3D): {
  geometries: Set<BufferGeometry>;
  materials: Set<Material>;
} {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  for (const mesh of collectMeshes(root)) {
    geometries.add(mesh.geometry);
    const mat = mesh.material;
    for (const m of Array.isArray(mat) ? mat : [mat]) materials.add(m);
  }
  return { geometries, materials };
}

describe('Modèle de Kiro en volume', () => {
  it('contient un corps, deux yeux, deux bras et un halo', () => {
    const kiro = createKiroGhost();
    const instanced = collectMeshes(kiro.group).filter(
      (m): m is InstancedMesh => m instanceof InstancedMesh,
    );

    expect(kiro.group.children).toContain(kiro.body);
    expect(instanced.filter((m) => m.count === 2)).toHaveLength(2);
    expect(kiro.body.castShadow).toBe(true);
    kiro.dispose();
  });

  it('géométries et matériaux partagés : leur nombre reste constant après les mises à jour', () => {
    const kiro = createKiroGhost();
    const initial = collectResources(kiro.group);
    const meshCount = collectMeshes(kiro.group).length;

    for (let i = 0; i < 20; i++) {
      kiro.update({ x: i, y: -i, tilt: 0.1 * i, wobbleTime: i * 0.05, ...POSE });
    }

    const after = collectResources(kiro.group);
    expect(collectMeshes(kiro.group)).toHaveLength(meshCount);
    expect(after.geometries.size).toBe(initial.geometries.size);
    expect(after.materials.size).toBe(initial.materials.size);
    for (const g of initial.geometries) expect(after.geometries.has(g)).toBe(true);
    for (const m of initial.materials) expect(after.materials.has(m)).toBe(true);
    kiro.dispose();
  });

  it('mouvement réduit : le bas du corps ne bouge pas avec le temps', () => {
    const kiro = createKiroGhost();
    kiro.update({ x: 0, y: 0, tilt: 0, wobbleTime: 0, ...POSE, reducedMotion: true });
    const before = new Box3().setFromObject(kiro.body);
    for (const wobbleTime of [0.1, 0.37, 1.5, 42]) {
      kiro.update({ x: 0, y: 0, tilt: 0, wobbleTime, ...POSE, reducedMotion: true });
      expect(new Box3().setFromObject(kiro.body).equals(before)).toBe(true);
    }
    kiro.dispose();
  });

  it('dispose libère les géométries et les matériaux', () => {
    const kiro = createKiroGhost();
    const { geometries, materials } = collectResources(kiro.group);
    const disposedGeometries = new Set<BufferGeometry>();
    const disposedMaterials = new Set<Material>();

    for (const g of geometries) g.addEventListener('dispose', () => disposedGeometries.add(g));
    for (const m of materials) m.addEventListener('dispose', () => disposedMaterials.add(m));

    kiro.dispose();

    expect(geometries.size).toBeGreaterThan(0);
    expect(disposedGeometries.size).toBe(geometries.size);
    expect(disposedMaterials.size).toBe(materials.size);
  });
});
