import { Color, Scene } from 'three';
import type { Fog, PerspectiveCamera } from 'three';
import { GAME_CONFIG } from '../config/game.config';
import { PALETTE } from '../config/palette';
import { RENDER_CONFIG } from '../config/render.config';
import type { World } from '../game/state';
import { createKiroGhost, computeKiroTilt } from './actors/kiro-ghost';
import { selectClip } from './actors/ghost-sprite-frames';
import type { GhostClip } from './actors/ghost-sprite-frames';
import { createTombstones } from './actors/tombstones';
import { advanceAnimClock, createAnimClock } from './anim-clock';
import {
  applyPose,
  applyProjection,
  computeCoverHalfWidth,
  computePose,
  computeProjection,
  createPerspectiveCamera,
  createPose,
  createProjection,
  sanitizeAspect,
} from './camera';
import { createBoundaries } from './environment/boundaries';
import { createFog, updateFog } from './environment/fog';
import { createMoon } from './environment/moon';
import { createParallaxLayers, scrollDistance } from './environment/parallax';
import { createShadowReceiver } from './environment/shadow-receiver';
import { effectiveAlpha, interpolate } from './interpolation';
import { addLights, createLights, updateKiroLight } from './lights';
import type { Projection } from './camera';

/** Crée la scène avec la couleur de fond de la palette. */
export function createScene(): Scene {
  const scene = new Scene();
  scene.background = new Color(PALETTE.BACKGROUND);
  return scene;
}

export interface RenderScene {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly projection: Readonly<Projection>;
  /** Met à jour tous les objets pour l'image : lit l'état, aucun effet sur le Moteur. */
  update(alpha: number, nowSeconds: number): void;
  /** Recalcule la projection, le brouillard, le sol et le décor pour une taille en pixels. */
  resize(width: number, height: number): void;
  dispose(): void;
}

const WORLD = GAME_CONFIG.WORLD;
const ZONE_HALF_WIDTH = (WORLD.RIGHT - WORLD.LEFT) / 2;

/** Construit la scène complète sans canvas, WebGLRenderer ni DOM. */
export function createRenderScene(options: { world: Readonly<World> }): RenderScene {
  const { world } = options;

  const scene = createScene();
  const fog: Fog = createFog();
  scene.fog = fog;

  const rig = createLights();
  addLights(scene, rig);

  const receiver = createShadowReceiver();
  const kiroGhost = createKiroGhost();
  const tombstones = createTombstones(GAME_CONFIG.POOL_SIZE);
  const boundaries = createBoundaries();
  const parallax = createParallaxLayers();
  const moon = createMoon();

  scene.add(
    receiver,
    kiroGhost.group,
    tombstones.bodies,
    tombstones.caps,
    tombstones.rims,
    tombstones.faces,
    boundaries.floor,
    boundaries.ceiling,
    ...parallax.meshes,
    ...moon.meshes,
  );

  const camera = createPerspectiveCamera();
  const projection = createProjection();
  const pose = createPose();
  const clock = createAnimClock();
  const frame = {
    x: 0,
    y: 0,
    tilt: 0,
    wobbleTime: 0,
    clip: 'float' as GhostClip,
    clipTime: 0,
    reducedMotion: false,
  };
  let clipStart = 0;

  // Mouvement réduit : lu une fois, suivi par écouteur ; absent => false.
  const motionQuery =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;
  frame.reducedMotion = motionQuery?.matches ?? false;
  const onMotionChange = (event: { matches: boolean }): void => {
    frame.reducedMotion = event.matches;
  };
  motionQuery?.addEventListener?.('change', onMotionChange);

  function resize(width: number, height: number): void {
    const aspect = sanitizeAspect(width / height);
    computeProjection(aspect, projection);
    applyProjection(camera, projection);
    updateFog(fog, projection.distance);
    boundaries.setHalfWidth(
      Math.max(
        computeCoverHalfWidth(projection, 0),
        computeCoverHalfWidth(projection, -RENDER_CONFIG.BOUNDARY.DEPTH),
        ZONE_HALF_WIDTH,
      ),
    );
    parallax.resize(projection);
  }

  function update(alpha: number, nowSeconds: number): void {
    const phase = world.phase;
    const kiro = world.kiro;
    const a = effectiveAlpha(phase, alpha);
    const running = phase === 'Title' || phase === 'Playing';

    const y = interpolate(kiro.prevY, kiro.y, a);
    const vy = interpolate(kiro.prevVy, kiro.vy, a);
    frame.x = kiro.x;
    frame.y = y;
    frame.tilt = computeKiroTilt(vy);
    frame.wobbleTime = advanceAnimClock(clock, nowSeconds, running);
    const clip = selectClip(phase, vy);
    if (clip !== frame.clip) {
      frame.clip = clip;
      clipStart = nowSeconds;
    }
    const elapsed = nowSeconds - clipStart;
    frame.clipTime = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
    kiroGhost.update(frame);
    updateKiroLight(rig, kiro.x, y);

    tombstones.update(world.pool, a);
    const distance = scrollDistance(world.stepIndex, a);
    parallax.update(distance);
    moon.update(distance);

    computePose(projection, y, pose);
    applyPose(camera, pose);
  }

  function dispose(): void {
    motionQuery?.removeEventListener?.('change', onMotionChange);
    kiroGhost.dispose();
    tombstones.dispose();
    boundaries.dispose();
    parallax.dispose();
    moon.dispose();
    receiver.geometry.dispose();
    const material = receiver.material;
    if (Array.isArray(material)) for (const m of material) m.dispose();
    else material.dispose();
    rig.main.shadow.dispose();
  }

  resize(1, 1);

  return { scene, camera, projection, update, resize, dispose };
}
