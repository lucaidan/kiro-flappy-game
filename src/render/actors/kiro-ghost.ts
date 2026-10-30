import {
  AdditiveBlending,
  CapsuleGeometry,
  CircleGeometry,
  DynamicDrawUsage,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { GAME_CONFIG } from '../../config/game.config';
import { PALETTE } from '../../config/palette';
import { RENDER_CONFIG } from '../../config/render.config';
import { computeGhostPose, hemOffset } from './ghost-pose';
import type { GhostPose } from './ghost-pose';
import type { GhostClip } from './ghost-sprite-frames';

export interface KiroFrame {
  /** Position dessinée (interpolée), unités monde. */
  x: number;
  y: number;
  /** Angle d'inclinaison en radians. */
  tilt: number;
  /** Temps d'animation en secondes. */
  wobbleTime: number;
  /** Clip courant (flottement, battement, dissipation). */
  clip: GhostClip;
  /** Secondes écoulées depuis le début du clip courant. */
  clipTime: number;
  /** Mouvement réduit : bas immobile, bras sans balancement. */
  reducedMotion: boolean;
}

export interface KiroGhost {
  /** Position + inclinaison (rotation.z). */
  readonly group: Group;
  /** Corps en volume (sphère aplatie, bas ondulant), projette une ombre. */
  readonly body: Mesh;
  update(frame: Readonly<KiroFrame>): void;
  dispose(): void;
}

const EYE_COUNT = 2;
const ARM_COUNT = 2;
/** Intervalle minimal entre deux recalculs des normales du corps (secondes). */
const NORMALS_INTERVAL = 1 / 20;

/** Inclinaison : clamp(vy × TILT_PER_SPEED, ±TILT_MAX) ; 0 si la vitesse n'est pas finie. */
export function computeKiroTilt(vy: number): number {
  if (!Number.isFinite(vy)) return 0;
  const { TILT_PER_SPEED, TILT_MAX } = RENDER_CONFIG.KIRO;
  const tilt = vy * TILT_PER_SPEED;
  return Math.min(TILT_MAX, Math.max(-TILT_MAX, tilt));
}

export function createKiroGhost(): KiroGhost {
  const cfg = RENDER_CONFIG.KIRO;
  const halo = RENDER_CONFIG.HALO;
  const radius = GAME_CONFIG.KIRO.RADIUS;

  // Corps : sphère aplatie en profondeur ; les sommets du bas sont déplacés par le CPU.
  const bodyGeometry = new SphereGeometry(radius, cfg.SEGMENTS_W, cfg.SEGMENTS_H);
  bodyGeometry.scale(1, 1, cfg.BODY_DEPTH_SCALE);
  const positions = bodyGeometry.getAttribute('position');
  const basePositions = new Float32Array(positions.array as ArrayLike<number>);
  // Sommets concernés : y normalisé sous RING_FROM_Y ; angle autour de l'axe vertical.
  const hemIndices: number[] = [];
  const hemAngles: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const bx = basePositions[i * 3] ?? 0;
    const by = basePositions[i * 3 + 1] ?? 0;
    const bz = basePositions[i * 3 + 2] ?? 0;
    if (by / radius < cfg.HEM.RING_FROM_Y) {
      hemIndices.push(i);
      hemAngles.push(Math.atan2(bz, bx));
    }
  }
  const bodyMaterial = new MeshStandardMaterial({ color: PALETTE.KIRO });

  // Yeux ovales : sphère unitaire étirée par instance.
  const eyeGeometry = new SphereGeometry(1, cfg.SEGMENTS_W, cfg.SEGMENTS_H);
  const eyeMaterial = new MeshStandardMaterial({ color: PALETTE.KIRO_EYE });

  // Bras : capsules (axe Y) orientées chaque image.
  const armGeometry = new CapsuleGeometry(
    cfg.ARM.RADIUS,
    Math.max(0, cfg.ARM.LENGTH - 2 * cfg.ARM.RADIUS),
    4,
    8,
  );
  const armMaterial = new MeshStandardMaterial({ color: PALETTE.KIRO });

  const haloGeometry = new CircleGeometry(halo.RADIUS, cfg.SEGMENTS_W);
  const haloMaterial = new MeshBasicMaterial({
    color: PALETTE.KIRO_HALO,
    transparent: true,
    opacity: halo.OPACITY,
    blending: AdditiveBlending,
    depthWrite: false,
  });

  const group = new Group();

  const body = new Mesh(bodyGeometry, bodyMaterial);
  body.castShadow = true;
  group.add(body);

  // Yeux : matrices écrites une seule fois.
  const eyes = new InstancedMesh(eyeGeometry, eyeMaterial, EYE_COUNT);
  const tmp = new Matrix4();
  const eyeScale = new Vector3(cfg.EYE.RADIUS_X, cfg.EYE.RADIUS_Y, cfg.EYE.RADIUS_Z);
  const noRotation = new Quaternion();
  for (let i = 0; i < EYE_COUNT; i++) {
    const side = i === 0 ? -1 : 1;
    tmp.compose(
      new Vector3(side * cfg.EYE_OFFSET_X, cfg.EYE_OFFSET_Y, cfg.EYE_Z),
      noRotation,
      eyeScale,
    );
    eyes.setMatrixAt(i, tmp);
  }
  eyes.instanceMatrix.needsUpdate = true;
  eyes.frustumCulled = false;
  group.add(eyes);

  // Bras : deux instances, matrices réécrites à chaque image.
  const arms = new InstancedMesh(armGeometry, armMaterial, ARM_COUNT);
  arms.instanceMatrix.setUsage(DynamicDrawUsage);
  arms.castShadow = true;
  arms.frustumCulled = false;
  group.add(arms);

  const haloMesh = new Mesh(haloGeometry, haloMaterial);
  haloMesh.position.z = halo.Z;
  group.add(haloMesh);

  const pose: GhostPose = { armAngle: 0, armSway: 0, hemAmplitude: 0, opacity: 1, scale: 1 };
  const armPosition = new Vector3();
  const armQuaternion = new Quaternion();
  const armEuler = new Euler();
  const armScale = new Vector3(1, 1, 1);
  let lastNormalsTime = -Infinity;
  let lastAmplitude = -1;

  function updateHem(wobbleTime: number, amplitude: number): void {
    for (let k = 0; k < hemIndices.length; k++) {
      const i = hemIndices[k] ?? 0;
      const offset = hemOffset(hemAngles[k] ?? 0, wobbleTime, amplitude);
      positions.setY(i, (basePositions[i * 3 + 1] ?? 0) + offset);
    }
    positions.needsUpdate = true;
    // Normales recalculées à faible fréquence (quelques centaines de sommets).
    if (
      amplitude !== lastAmplitude ||
      Math.abs(wobbleTime - lastNormalsTime) >= NORMALS_INTERVAL
    ) {
      bodyGeometry.computeVertexNormals();
      lastNormalsTime = wobbleTime;
      lastAmplitude = amplitude;
    }
  }

  function updateArms(): void {
    const angle = pose.armAngle + pose.armSway;
    for (let i = 0; i < ARM_COUNT; i++) {
      const side = i === 0 ? -1 : 1;
      // Direction de l'épaule vers la main, miroir pour le bras gauche.
      const dx = side * Math.cos(angle);
      const dy = Math.sin(angle);
      armEuler.set(0, 0, Math.atan2(-dx, dy));
      armQuaternion.setFromEuler(armEuler);
      armPosition.set(
        side * cfg.ARM.SHOULDER_X + dx * (cfg.ARM.LENGTH / 2),
        cfg.ARM.SHOULDER_Y + dy * (cfg.ARM.LENGTH / 2),
        0,
      );
      tmp.compose(armPosition, armQuaternion, armScale);
      arms.setMatrixAt(i, tmp);
    }
    arms.instanceMatrix.needsUpdate = true;
  }

  function applyOpacity(opacity: number): void {
    const transparent = opacity < 1;
    for (const m of [bodyMaterial, eyeMaterial, armMaterial]) {
      m.transparent = transparent;
      m.opacity = opacity;
      m.depthWrite = !transparent;
    }
    haloMaterial.opacity = halo.OPACITY * opacity;
  }

  return {
    group,
    body,
    update(frame: Readonly<KiroFrame>): void {
      group.position.set(frame.x, frame.y, 0);
      group.rotation.z = frame.tilt;
      computeGhostPose(frame.clip, frame.clipTime, frame.reducedMotion, pose);
      group.scale.setScalar(pose.scale);
      applyOpacity(pose.opacity);
      updateHem(frame.wobbleTime, pose.hemAmplitude);
      updateArms();
    },
    dispose(): void {
      bodyGeometry.dispose();
      bodyMaterial.dispose();
      eyeGeometry.dispose();
      eyeMaterial.dispose();
      armGeometry.dispose();
      armMaterial.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
      eyes.dispose();
      arms.dispose();
    },
  };
}
