import {
  BoxGeometry,
  type BufferGeometry,
  CircleGeometry,
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
} from 'three';
import { PALETTE } from '../../config/palette';
import { RENDER_CONFIG } from '../../config/render.config';
import { obstacleRects } from '../../game/obstacles';
import type { Obstacle, ObstaclePool, ObstacleRect, RectPair } from '../../game/obstacles';
import { interpolate } from '../interpolation';

/** Découpage d'une Stèle en hauteur de chapiteau et hauteur de corps. */
export interface SteleSplit {
  cap: number;
  body: number;
}

/**
 * cap = min(CAP_HEIGHT, h) ; body = h - cap ; h borné à [0, +inf[ (4.4).
 * Écrit dans `out`, sans allocation.
 */
export function splitSteleHeight(height: number, out: SteleSplit): void {
  const h = Number.isFinite(height) && height > 0 ? height : 0;
  const cap = Math.min(RENDER_CONFIG.CAP_HEIGHT, h);
  out.cap = cap;
  out.body = h - cap;
}

export interface Tombstones {
  /** 2 × POOL_SIZE instances (2i = Stèle basse, 2i + 1 = Stèle haute). */
  readonly bodies: InstancedMesh;
  readonly caps: InstancedMesh;
  readonly rims: InstancedMesh;
  /** Visages de citrouille émissifs, posés sur la face avant (3.2, 3.3). */
  readonly faces: InstancedMesh;
  update(pool: ObstaclePool, alpha: number): void;
  dispose(): void;
}

function createMesh(
  geometry: BufferGeometry,
  material: MeshStandardMaterial,
  count: number,
  castShadow: boolean,
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.castShadow = castShadow;
  mesh.frustumCulled = false;
  // Toutes les instances sont masquées tant que `update` n'a pas été appelé.
  const hidden = new Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, hidden);
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

/** Crée les Stèles : trois InstancedMesh de `2 × poolSize` instances (4.2, 12.3). */
export function createTombstones(poolSize: number): Tombstones {
  const count = 2 * poolSize;
  const depth = RENDER_CONFIG.STELE.DEPTH;
  const rimHeight = RENDER_CONFIG.STELE.RIM_HEIGHT;
  const rimOffset = RENDER_CONFIG.STELE.RIM_Z_OFFSET;

  // Boîte unitaire, face avant sur z = 0 (z dans [-1, 0]).
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.translate(0, 0, -0.5);

  // Couleur par instance (parité du Slot) : le matériau reste blanc.
  const bodyMaterial = new MeshStandardMaterial({ color: PALETTE.WHITE });
  const capMaterial = new MeshStandardMaterial({ color: PALETTE.WHITE });
  const rimMaterial = new MeshStandardMaterial({ color: PALETTE.STELE_RIM });

  const bodies = createMesh(geometry, bodyMaterial, count, true);
  const caps = createMesh(geometry, capMaterial, count, true);
  const rims = createMesh(geometry, rimMaterial, count, false);

  const theme = RENDER_CONFIG.OBSTACLE_THEME;
  const evenColor = new Color(PALETTE[theme.EVEN]);
  const oddColor = new Color(PALETTE[theme.ODD]);
  const capEven = new Color(PALETTE.STELE_CAP);
  for (let i = 0; i < count; i++) {
    const odd = Math.floor(i / 2) % 2 === 1;
    bodies.setColorAt(i, odd ? oddColor : evenColor);
    caps.setColorAt(i, odd ? oddColor : capEven);
  }

  const faceRadius = theme.FACE_RADIUS;
  const faceGeometry = new CircleGeometry(faceRadius, theme.FACE_SEGMENTS);
  const faceMaterial = new MeshStandardMaterial({
    color: PALETTE.PUMPKIN,
    emissive: PALETTE.PUMPKIN_GLOW,
  });
  const faces = createMesh(faceGeometry, faceMaterial, count, false);

  // Objets de travail préallouées (9.1, 9.3, 12.4).
  const matrix = new Matrix4();
  const hidden = new Matrix4().makeScale(0, 0, 0);
  const work: Obstacle = { active: true, x: 0, prevX: 0, gapCenterY: 0, passed: false };
  const rects: RectPair = {
    top: { left: 0, right: 0, bottom: 0, top: 0 },
    bottom: { left: 0, right: 0, bottom: 0, top: 0 },
  };
  const split: SteleSplit = { cap: 0, body: 0 };

  function put(
    mesh: InstancedMesh,
    index: number,
    left: number,
    width: number,
    bottom: number,
    top: number,
    z: number,
    zScale: number,
  ): void {
    const h = top - bottom;
    if (!(h > 0) || !(width > 0)) {
      mesh.setMatrixAt(index, hidden);
      return;
    }
    matrix.makeScale(width, h, zScale);
    matrix.setPosition(left + width / 2, bottom + h / 2, z);
    mesh.setMatrixAt(index, matrix);
  }

  /** Visage centré dans le rectangle ; masqué s'il n'y tient pas. */
  function putFace(index: number, r: ObstacleRect): void {
    const diameter = 2 * faceRadius;
    if (r.right - r.left < diameter || r.top - r.bottom < diameter) {
      faces.setMatrixAt(index, hidden);
      return;
    }
    matrix.makeScale(1, 1, 1);
    matrix.setPosition((r.left + r.right) / 2, (r.bottom + r.top) / 2, theme.FACE_Z_OFFSET);
    faces.setMatrixAt(index, matrix);
  }

  /** `capOnTop` : le chapiteau est en haut du rectangle (Stèle basse), sinon en bas. */
  function writeStele(index: number, r: ObstacleRect, capOnTop: boolean): void {
    const width = r.right - r.left;
    putFace(index, r);
    splitSteleHeight(r.top - r.bottom, split);
    const height = r.top - r.bottom;
    const rim = Math.min(rimHeight, Math.max(height, 0));
    if (capOnTop) {
      const split0 = r.top - split.cap;
      put(bodies, index, r.left, width, r.bottom, split0, 0, depth);
      put(caps, index, r.left, width, split0, r.top, 0, depth);
      put(rims, index, r.left, width, r.top - rim, r.top, rimOffset, depth + rimOffset);
    } else {
      const split0 = r.bottom + split.cap;
      put(bodies, index, r.left, width, split0, r.top, 0, depth);
      put(caps, index, r.left, width, r.bottom, split0, 0, depth);
      put(rims, index, r.left, width, r.bottom, r.bottom + rim, rimOffset, depth + rimOffset);
    }
  }

  return {
    bodies,
    caps,
    rims,
    faces,
    update(pool: ObstaclePool, alpha: number): void {
      const items = pool.items;
      for (let i = 0; i < poolSize; i++) {
        const o = items[i];
        const low = 2 * i;
        const high = low + 1;
        if (o === undefined || !o.active) {
          bodies.setMatrixAt(low, hidden);
          bodies.setMatrixAt(high, hidden);
          caps.setMatrixAt(low, hidden);
          caps.setMatrixAt(high, hidden);
          rims.setMatrixAt(low, hidden);
          rims.setMatrixAt(high, hidden);
          faces.setMatrixAt(low, hidden);
          faces.setMatrixAt(high, hidden);
          continue;
        }
        work.x = interpolate(o.prevX, o.x, alpha);
        work.prevX = work.x;
        work.gapCenterY = o.gapCenterY;
        obstacleRects(work, rects);
        writeStele(low, rects.bottom, true);
        writeStele(high, rects.top, false);
      }
      bodies.instanceMatrix.needsUpdate = true;
      caps.instanceMatrix.needsUpdate = true;
      rims.instanceMatrix.needsUpdate = true;
      faces.instanceMatrix.needsUpdate = true;
    },
    dispose(): void {
      geometry.dispose();
      faceGeometry.dispose();
      faceMaterial.dispose();
      faces.dispose();
      bodyMaterial.dispose();
      capMaterial.dispose();
      rimMaterial.dispose();
      bodies.dispose();
      caps.dispose();
      rims.dispose();
    },
  };
}



