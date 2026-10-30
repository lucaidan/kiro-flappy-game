import {
  BoxGeometry,
  ConeGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  SphereGeometry,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GAME_CONFIG } from '../../config/game.config';
import { PALETTE } from '../../config/palette';
import { RENDER_CONFIG } from '../../config/render.config';
import { clampAlpha } from '../interpolation';
import { computeCoverHalfWidth, computeProjection, createProjection, type Projection } from '../camera';

/** Segments radiaux du cône neutre de M2. */
const CONE_SEGMENTS = 4;
/** Profondeur de la boîte neutre de M2. */
const BOX_DEPTH = 1;
/** Segments des dômes de colline. */
const HILL_SEGMENTS = 16;
const HILL_RINGS = 4;
/** Tuiles ajoutées à la borne minimale pour que le décalage ne laisse aucune zone nue. */
const EXTRA_TILES = 2;

const WORLD = GAME_CONFIG.WORLD;
const CENTER_X = (WORLD.LEFT + WORLD.RIGHT) / 2;

interface LayerSpec {
  readonly Z: number;
  readonly PARALLAX: number;
  readonly PERIOD: number;
  readonly SHAPE: 'plane' | 'cone' | 'box' | 'hill' | 'church' | 'tree';
  readonly WIDTH: number;
  readonly HEIGHT: number;
  readonly BASE_Y: number;
  readonly COLOR: keyof typeof PALETTE;
}

/** (distance × factor) modulo period, dans [0, period[ ; 0 si entrée invalide. */
export function parallaxOffset(distance: number, factor: number, period: number): number {
  if (!Number.isFinite(distance) || !Number.isFinite(factor) || !Number.isFinite(period) || period <= 0) {
    return 0;
  }
  const raw = (distance * factor) % period;
  const offset = raw < 0 ? raw + period : raw;
  return offset >= period ? 0 : offset;
}

/** (stepIndex + clampAlpha(alpha)) × SCROLL_SPEED × FIXED_DT ; stepIndex invalide donne 0. */
export function scrollDistance(stepIndex: number, alpha: number): number {
  if (!Number.isFinite(stepIndex) || stepIndex < 0) return 0;
  return (stepIndex + clampAlpha(alpha)) * GAME_CONFIG.SCROLL_SPEED * GAME_CONFIG.FIXED_DT;
}

/** Nombre de tuiles : ceil(2 × coverHalfWidth / period) + 2. */
export function layerTileCount(coverHalfWidth: number, period: number): number {
  if (!Number.isFinite(coverHalfWidth) || !Number.isFinite(period) || period <= 0 || coverHalfWidth < 0) {
    return EXTRA_TILES;
  }
  return Math.ceil((2 * coverHalfWidth) / period) + EXTRA_TILES;
}

/** Centre x de la tuile `index` : origin + index × period − offset. */
export function tileCenterX(index: number, origin: number, period: number, offset: number): number {
  return origin + index * period - offset;
}

export interface ParallaxLayers {
  readonly meshes: readonly InstancedMesh[];
  /** Recalcule couverture et nombre de tuiles pour une nouvelle projection. */
  resize(projection: Readonly<Projection>): void;
  /** Place les tuiles pour la Distance_Defilement donnée (sans effet si inchangée). */
  update(distance: number): void;
  dispose(): void;
}

/** Fusionne des parties (toutes indexées avec position/normal/uv) puis les libère. */
function mergeParts(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error('parallax: fusion de géométries impossible');
  return merged;
}

/** Deux dômes de tailles différentes, centrés sur y = 0 (étendue ±W/2 × ±H/2). */
function createHillGeometry(width: number, height: number): BufferGeometry {
  const dome = (w: number, h: number, x: number): BufferGeometry => {
    const g = new SphereGeometry(0.5, HILL_SEGMENTS, HILL_RINGS, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(w, h * 2, BOX_DEPTH * 2);
    g.translate(x, -height / 2, 0);
    return g;
  };
  return mergeParts([dome(width * 0.6, height, -width * 0.2), dome(width * 0.45, height * 0.6, width * 0.25)]);
}

/** Nef, tour et flèche, centrés sur y = 0. */
function createChurchGeometry(width: number, height: number): BufferGeometry {
  const nave = new BoxGeometry(width, height * 0.35, BOX_DEPTH);
  nave.translate(0, -height / 2 + (height * 0.35) / 2, 0);
  const towerW = width * 0.4;
  const towerH = height * 0.65;
  const tower = new BoxGeometry(towerW, towerH, BOX_DEPTH);
  tower.translate(-width * 0.25, -height / 2 + towerH / 2, 0);
  const spireH = height * 0.35;
  const spire = new ConeGeometry(towerW * 0.7, spireH, CONE_SEGMENTS);
  spire.translate(-width * 0.25, -height / 2 + towerH + spireH / 2, 0);
  return mergeParts([nave, tower, spire]);
}

/** Tronc et trois branches inclinées, centrés sur y = 0. */
function createTreeGeometry(width: number, height: number): BufferGeometry {
  const trunkW = width * 0.18;
  const trunk = new BoxGeometry(trunkW, height, BOX_DEPTH * 0.5);
  const branch = (length: number, angle: number, y: number): BufferGeometry => {
    const g = new BoxGeometry(length, trunkW * 0.6, BOX_DEPTH * 0.5);
    g.translate(Math.sign(angle) * (length / 2), 0, 0);
    g.rotateZ(angle);
    g.translate(0, y, 0);
    return g;
  };
  const base = -height / 2;
  return mergeParts([
    trunk,
    branch(width * 0.45, 0.7, base + height * 0.5),
    branch(width * 0.4, -0.8, base + height * 0.65),
    branch(width * 0.3, 0.9, base + height * 0.8),
  ]);
}

function createGeometry(spec: LayerSpec): BufferGeometry {
  switch (spec.SHAPE) {
    case 'plane':
      return new PlaneGeometry(spec.WIDTH, spec.HEIGHT);
    case 'cone':
      return new ConeGeometry(spec.WIDTH / 2, spec.HEIGHT, CONE_SEGMENTS);
    case 'box':
      return new BoxGeometry(spec.WIDTH, spec.HEIGHT, BOX_DEPTH);
    case 'hill':
      return createHillGeometry(spec.WIDTH, spec.HEIGHT);
    case 'church':
      return createChurchGeometry(spec.WIDTH, spec.HEIGHT);
    case 'tree':
      return createTreeGeometry(spec.WIDTH, spec.HEIGHT);
  }
}

export function createParallaxLayers(): ParallaxLayers {
  const specs: readonly LayerSpec[] = [...RENDER_CONFIG.DECOR_LAYERS, RENDER_CONFIG.FOREGROUND];

  // Capacité fixée pour le rapport d'aspect maximal couvert.
  const maxProjection = createProjection();
  computeProjection(RENDER_CONFIG.CAMERA.ASPECT_COVER_MAX, maxProjection);

  const geometries: BufferGeometry[] = [];
  const materials: MeshBasicMaterial[] = [];
  const meshes: InstancedMesh[] = [];
  const origins: number[] = [];

  for (const spec of specs) {
    const geometry = createGeometry(spec);
    const material = new MeshBasicMaterial({ color: PALETTE[spec.COLOR], fog: true });
    const capacity = layerTileCount(computeCoverHalfWidth(maxProjection, spec.Z), spec.PERIOD);
    const mesh = new InstancedMesh(geometry, material, capacity);
    mesh.count = 0;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    geometries.push(geometry);
    materials.push(material);
    meshes.push(mesh);
    origins.push(CENTER_X);
  }

  const matrix = new Matrix4();
  let dirty = true;
  let lastDistance = Number.NaN;

  function resize(projection: Readonly<Projection>): void {
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i] as LayerSpec;
      const mesh = meshes[i] as InstancedMesh;
      const cover = computeCoverHalfWidth(projection, spec.Z);
      origins[i] = CENTER_X - cover;
      mesh.count = Math.min(mesh.instanceMatrix.count, layerTileCount(cover, spec.PERIOD));
    }
    dirty = true;
  }

  function update(distance: number): void {
    const d = Number.isFinite(distance) ? distance : 0;
    if (!dirty && d === lastDistance) return;
    lastDistance = d;
    dirty = false;
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i] as LayerSpec;
      const mesh = meshes[i] as InstancedMesh;
      const origin = origins[i] as number;
      const offset = parallaxOffset(d, spec.PARALLAX, spec.PERIOD);
      const y = spec.BASE_Y + spec.HEIGHT / 2;
      for (let k = 0; k < mesh.count; k++) {
        matrix.setPosition(tileCenterX(k, origin, spec.PERIOD, offset), y, spec.Z);
        mesh.setMatrixAt(k, matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  function dispose(): void {
    for (const mesh of meshes) mesh.dispose();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  }

  // Valeurs initiales cohérentes avec un aspect de repli.
  const initial = createProjection();
  computeProjection(RENDER_CONFIG.CAMERA.FALLBACK_ASPECT, initial);
  resize(initial);

  return { meshes, resize, update, dispose };
}
