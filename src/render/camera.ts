import { PerspectiveCamera } from 'three';
import { GAME_CONFIG } from '../config/game.config';
import { RENDER_CONFIG } from '../config/render.config';

/** Paramètres de projection (indépendants de la position verticale de Kiro). */
export interface Projection {
  fovDeg: number;
  aspect: number;
  distance: number;
  near: number;
  far: number;
  coverAspect: number;
}

/** Position de la caméra et point visé. */
export interface Pose {
  px: number;
  py: number;
  pz: number;
  tx: number;
  ty: number;
  tz: number;
}

const CAM = RENDER_CONFIG.CAMERA;
const WORLD = GAME_CONFIG.WORLD;
const DEG = Math.PI / 180;

const YAW = CAM.YAW_DEG * DEG;
const PITCH = CAM.PITCH_DEG * DEG;
// Base orthonormée de la caméra (équivalente à lookAt avec le haut monde (0, 1, 0)).
const FX = Math.sin(YAW) * Math.cos(PITCH);
const FY = -Math.sin(PITCH);
const FZ = -Math.cos(YAW) * Math.cos(PITCH);
const RX = Math.cos(YAW);
const RZ = Math.sin(YAW);
const UX = Math.sin(YAW) * Math.sin(PITCH);
const UY = Math.cos(PITCH);
const UZ = -Math.cos(YAW) * Math.sin(PITCH);
const TAN_V = Math.tan((RENDER_CONFIG.FOV_DEG * DEG) / 2);

const CENTER_X = (WORLD.LEFT + WORLD.RIGHT) / 2;
const CENTER_Y = (WORLD.FLOOR + WORLD.CEILING) / 2;
const HALF_H = (WORLD.CEILING - WORLD.FLOOR) / 2;
const AIM_X = GAME_CONFIG.KIRO.START_X + CAM.AIM_AHEAD_X;
const MARGIN = RENDER_CONFIG.VIEW_MARGIN;
const MAX_FOLLOW = RENDER_CONFIG.FOLLOW_Y * HALF_H;

const LAYERS = [...RENDER_CONFIG.DECOR_LAYERS, RENDER_CONFIG.FOREGROUND];
// Plans dont la couverture horizontale doit rester dans le volume de profondeur.
const COVER_PLANES: readonly number[] = [0, -RENDER_CONFIG.BOUNDARY.DEPTH, ...LAYERS.map((l) => l.Z)];
const Z_DEEP = Math.max(0, ...COVER_PLANES.map((z) => -z));
const Z_FRONT = Math.max(
  0,
  RENDER_CONFIG.STELE.DEPTH / 2,
  RENDER_CONFIG.BOUNDARY.DEPTH / 2,
  ...COVER_PLANES,
);
const H_EXTENT =
  HALF_H +
  MARGIN +
  MAX_FOLLOW +
  Math.max(0, ...LAYERS.map((l) => Math.abs(l.BASE_Y) + l.HEIGHT));
const MAX_PERIOD = Math.max(...LAYERS.map((l) => l.PERIOD));

// Quatre coins de la Zone_Jeu agrandie de VIEW_MARGIN, au décalage de suivi extrême.
const CORNER_XS = [WORLD.LEFT - MARGIN, WORLD.RIGHT + MARGIN] as const;
const CORNER_YS = [WORLD.FLOOR - MARGIN, WORLD.CEILING + MARGIN] as const;
const FOLLOW_EXTREMES = [-MAX_FOLLOW, MAX_FOLLOW] as const;

export function createProjection(): Projection {
  return { fovDeg: RENDER_CONFIG.FOV_DEG, aspect: 1, distance: CAM.MIN_DISTANCE, near: CAM.NEAR_MIN, far: 100, coverAspect: 1 };
}

export function createPose(): Pose {
  return { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0 };
}

/** Rapport d'aspect utilisable : repli sur FALLBACK_ASPECT si non fini ou <= 0. */
export function sanitizeAspect(aspect: number): number {
  return Number.isFinite(aspect) && aspect > 0 ? aspect : CAM.FALLBACK_ASPECT;
}

/** Suivi_Vertical : FOLLOW_Y × (kiroY − centre vertical de la Zone_Jeu), kiroY borné à la Zone_Jeu. */
export function computeFollowOffset(kiroY: number): number {
  if (!Number.isFinite(kiroY)) return 0;
  const y = Math.min(WORLD.CEILING, Math.max(WORLD.FLOOR, kiroY));
  return RENDER_CONFIG.FOLLOW_Y * (y - CENTER_Y);
}

/** Demi-largeur horizontale couverte par le frustum sur le plan z = zPlane, sans marge. */
function coverFromDistance(distance: number, coverAspect: number, zPlane: number): number {
  const pxCam = AIM_X - distance * FX;
  const pzCam = -distance * FZ;
  const tv = TAN_V;
  const th = TAN_V * coverAspect;
  let best = 0;
  for (let i = 0; i < 4; i++) {
    const sr = i & 1 ? 1 : -1;
    const su = i & 2 ? 1 : -1;
    const dx = FX + sr * th * RX + su * tv * UX;
    const dz = Math.min(FZ + sr * th * RZ + su * tv * UZ, -CAM.RAY_EPSILON);
    const x = pxCam + ((zPlane - pzCam) / dz) * dx;
    const gap = Math.abs(x - CENTER_X);
    if (gap > best) best = gap;
  }
  return best;
}

function fillProjection(aspect: number, out: Projection): void {
  const coverAspect = Math.min(aspect, CAM.ASPECT_COVER_MAX);
  let distance: number = CAM.MIN_DISTANCE;
  for (const cx of CORNER_XS) {
    for (const cy of CORNER_YS) {
      for (const off of FOLLOW_EXTREMES) {
        const rx = cx - AIM_X;
        const ry = cy - (CENTER_Y + off);
        const rr = rx * RX;
        const ru = rx * UX + ry * UY;
        const rf = rx * FX + ry * FY;
        const ar = Math.abs(rr);
        const au = Math.abs(ru);
        distance = Math.max(distance, ar / (TAN_V * aspect) - rf, au / TAN_V - rf);
      }
    }
  }
  out.fovDeg = RENDER_CONFIG.FOV_DEG;
  out.aspect = aspect;
  out.distance = distance;
  out.coverAspect = coverAspect;
  if (!Number.isFinite(distance)) return;

  let w = 0;
  for (let i = 0; i < COVER_PLANES.length; i++) {
    const c = coverFromDistance(distance, coverAspect, COVER_PLANES[i] as number);
    if (c > w) w = c;
  }
  w += MARGIN + MAX_PERIOD / 2;
  const spreadXY = w * Math.abs(FX) + H_EXTENT * Math.abs(FY);
  out.far = (distance + spreadXY + Z_DEEP * Math.abs(FZ)) * CAM.DEPTH_SAFETY;
  out.near = Math.max(CAM.NEAR_MIN, (distance - spreadXY - Z_FRONT * Math.abs(FZ)) / CAM.DEPTH_SAFETY);
}

/** Distance, plans proche et lointain, FOV et aspect (indépendant de kiroY). */
export function computeProjection(aspect: number, out: Projection): void {
  fillProjection(sanitizeAspect(aspect), out);
  if (!Number.isFinite(out.distance) || !Number.isFinite(out.far)) {
    fillProjection(CAM.FALLBACK_ASPECT, out);
  }
}

/** Position et point visé de la caméra pour la position verticale de Kiro. */
export function computePose(projection: Readonly<Projection>, kiroY: number, out: Pose): void {
  const ty = CENTER_Y + computeFollowOffset(kiroY);
  out.tx = AIM_X;
  out.ty = ty;
  out.tz = 0;
  out.px = AIM_X - projection.distance * FX;
  out.py = ty - projection.distance * FY;
  out.pz = -projection.distance * FZ;
}

/** Demi-largeur à couvrir sur le plan `z = zPlane` (centrée sur la Zone_Jeu). */
export function computeCoverHalfWidth(projection: Readonly<Projection>, zPlane: number): number {
  return coverFromDistance(projection.distance, projection.coverAspect, zPlane) + MARGIN;
}

export function createPerspectiveCamera(): PerspectiveCamera {
  const p = createProjection();
  computeProjection(1, p);
  const camera = new PerspectiveCamera(p.fovDeg, p.aspect, p.near, p.far);
  const pose = createPose();
  computePose(p, CENTER_Y, pose);
  applyPose(camera, pose);
  return camera;
}

export function applyProjection(camera: PerspectiveCamera, p: Readonly<Projection>): void {
  camera.fov = p.fovDeg;
  camera.aspect = p.aspect;
  camera.near = p.near;
  camera.far = p.far;
  camera.updateProjectionMatrix();
}

export function applyPose(camera: PerspectiveCamera, pose: Readonly<Pose>): void {
  camera.position.set(pose.px, pose.py, pose.pz);
  camera.lookAt(pose.tx, pose.ty, pose.tz);
}
