import { describe, it, expect } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { GAME_CONFIG } from '../../src/config/game.config';
import { RENDER_CONFIG } from '../../src/config/render.config';
import {
  applyPose,
  applyProjection,
  computeFollowOffset,
  computePose,
  computeProjection,
  createPerspectiveCamera,
  createPose,
  createProjection,
  sanitizeAspect,
} from '../../src/render/camera';

const WORLD = GAME_CONFIG.WORLD;
const CAM = RENDER_CONFIG.CAMERA;
const MARGIN = RENDER_CONFIG.VIEW_MARGIN;
const CENTER_Y = (WORLD.FLOOR + WORLD.CEILING) / 2;
const EPS = 1e-6;

describe('Cadrage', () => {
  it('lacet et tangage sont non nuls et bornés par TILT_MAX_DEG (1.2)', () => {
    for (const angle of [CAM.YAW_DEG, CAM.PITCH_DEG]) {
      expect(Math.abs(angle)).toBeGreaterThan(0);
      expect(Math.abs(angle)).toBeLessThanOrEqual(CAM.TILT_MAX_DEG);
    }
  });

  it('le point visé est devant Kiro sur z = 0 (1.3)', () => {
    const projection = createProjection();
    const pose = createPose();
    computeProjection(16 / 9, projection);
    computePose(projection, CENTER_Y, pose);
    expect(pose.tz).toBe(0);
    expect(pose.tx).toBeGreaterThan(GAME_CONFIG.KIRO.START_X);
    expect(pose.tx).toBeCloseTo(GAME_CONFIG.KIRO.START_X + CAM.AIM_AHEAD_X, 9);
  });

  it('FOLLOW_Y est appliqué à la hauteur visée (1.4)', () => {
    const projection = createProjection();
    const pose = createPose();
    computeProjection(16 / 9, projection);
    computePose(projection, WORLD.CEILING, pose);
    const expected = CENTER_Y + RENDER_CONFIG.FOLLOW_Y * (WORLD.CEILING - CENTER_Y);
    expect(pose.ty).toBeCloseTo(expected, 9);
    expect(computeFollowOffset(CENTER_Y)).toBeCloseTo(0, 9);
    computePose(projection, CENTER_Y, pose);
    expect(pose.ty).toBeCloseTo(CENTER_Y, 9);
  });

  it("le rapport d'aspect est copié sans déformation (2.2)", () => {
    const projection = createProjection();
    computeProjection(1.5, projection);
    expect(projection.aspect).toBe(1.5);
    const camera = new PerspectiveCamera();
    applyProjection(camera, projection);
    expect(camera.aspect).toBe(1.5);
    expect(camera.fov).toBe(RENDER_CONFIG.FOV_DEG);
  });

  it.each([0, -1, NaN, Infinity])("repli sur FALLBACK_ASPECT pour l'aspect %s (2.4)", (aspect) => {
    expect(sanitizeAspect(aspect)).toBe(CAM.FALLBACK_ASPECT);
    const projection = createProjection();
    computeProjection(aspect, projection);
    expect(projection.aspect).toBe(CAM.FALLBACK_ASPECT);
    expect(Number.isFinite(projection.distance)).toBe(true);
    expect(Number.isFinite(projection.far)).toBe(true);
  });

  it.each([
    ['16:9', 16 / 9],
    ['4:3', 4 / 3],
    ['9:16', 9 / 16],
  ])('les coins projetés pour %s sont dans le NDC', (_name, aspect) => {
    const camera = createPerspectiveCamera();
    const projection = createProjection();
    const pose = createPose();
    const corner = new Vector3();
    computeProjection(aspect, projection);
    computePose(projection, CENTER_Y, pose);
    applyProjection(camera, projection);
    applyPose(camera, pose);
    camera.updateMatrixWorld(true);
    for (const x of [WORLD.LEFT - MARGIN, WORLD.RIGHT + MARGIN]) {
      for (const y of [WORLD.FLOOR - MARGIN, WORLD.CEILING + MARGIN]) {
        corner.set(x, y, 0).project(camera);
        expect(Math.abs(corner.x)).toBeLessThanOrEqual(1 + EPS);
        expect(Math.abs(corner.y)).toBeLessThanOrEqual(1 + EPS);
      }
    }
  });
});
