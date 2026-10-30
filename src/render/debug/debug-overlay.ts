import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineSegments, Scene } from 'three';
import { GAME_CONFIG } from '../../config/game.config';
import { PALETTE } from '../../config/palette';
import { RENDER_CONFIG } from '../../config/render.config';
import { obstacleRects } from '../../game/obstacles';
import type { ObstacleRect, RectPair } from '../../game/obstacles';
import type { World } from '../../game/state';

/** Nombre de frames de la moyenne glissante du FPS (11.2). */
export const FPS_WINDOW = 60;
const CIRCLE_SEGMENTS = RENDER_CONFIG.DEBUG.CIRCLE_SEGMENTS;
/** Les contours sont dans le plan de jeu (10.2). */
const PLANE_Z = 0;
const VERTS_PER_SEGMENT = 2;
const SEGMENTS_PER_RECT = 4;
const RECTS_PER_OBSTACLE = 2;
const BOUNDARY_SEGMENTS = 2;
const COMPONENTS = 3;

export interface FpsMeter {
  /** Enregistre la durée (ms) d'une frame et retourne le FPS moyen sur la fenêtre. */
  push(frameMs: number): number;
}

/** Moyenne glissante sur `windowSize` frames, sans allocation après création. */
export function createFpsMeter(windowSize: number = FPS_WINDOW): FpsMeter {
  const samples = new Float64Array(windowSize);
  let count = 0;
  let index = 0;
  let sum = 0;
  return {
    push(frameMs: number): number {
      sum -= samples[index] ?? 0;
      samples[index] = frameMs;
      sum += frameMs;
      index = (index + 1) % windowSize;
      if (count < windowSize) count += 1;
      return sum > 0 ? (count * 1000) / sum : 0;
    },
  };
}

/** Formate la ligne de texte de l'overlay (FPS, état, score, graine). */
export function formatDebugText(
  fps: number,
  phase: string,
  score: number,
  seed: number,
  audio?: Readonly<AudioDebugInfo> | null,
): string {
  const base = `FPS: ${Math.round(fps)}\nÉtat: ${phase}\nScore: ${score}\nGraine: ${seed}`;
  if (audio === undefined || audio === null) return base;
  return (
    `${base}\nBPM: ${audio.bpm} | Temps: ${audio.beatIndex} | ` +
    `Vitesse: ${audio.scrollSpeed.toFixed(2)} | File: ${audio.queueSize}`
  );
}

/** Informations audio affichées par l'overlay (lecture seule). */
export interface AudioDebugInfo {
  bpm: number;
  beatIndex: number;
  scrollSpeed: number;
  queueSize: number;
}

export interface RenderStats {
  calls: number;
  triangles: number;
}

export interface FrameStats {
  game: RenderStats;
  overlay: RenderStats;
}

/** Ligne « Appels : n (+m debug), Triangles : n (+m debug) ». */
export function formatRenderStats(stats: Readonly<FrameStats>): string {
  return (
    `Appels : ${stats.game.calls} (+${stats.overlay.calls} debug), ` +
    `Triangles : ${stats.game.triangles} (+${stats.overlay.triangles} debug)`
  );
}

export interface HitboxOutlines {
  readonly lines: LineSegments;
  /** Réécrit le tampon de positions à partir de l'état courant du Moteur. */
  update(world: Readonly<World>): void;
  dispose(): void;
}

/**
 * Crée un seul `LineSegments` à tampon préalloué : cercle de Kiro, 2 rectangles par
 * Obstacle du Pool, lignes du sol et du plafond (10.1, 10.3).
 */
export function createHitboxOutlines(poolSize: number, scene: Scene): HitboxOutlines {
  const segments =
    CIRCLE_SEGMENTS + poolSize * RECTS_PER_OBSTACLE * SEGMENTS_PER_RECT + BOUNDARY_SEGMENTS;
  const geometry = new BufferGeometry();
  const attribute = new Float32BufferAttribute(segments * VERTS_PER_SEGMENT * COMPONENTS, COMPONENTS);
  // Le constructeur copie un tableau fourni : on écrit donc dans le tampon de l'attribut.
  const positions = attribute.array as Float32Array;
  geometry.setAttribute('position', attribute);

  const material = new LineBasicMaterial({
    color: PALETTE.DEBUG_HITBOX,
    depthTest: false,
    depthWrite: false,
  });
  const lines = new LineSegments(geometry, material);
  lines.renderOrder = RENDER_CONFIG.DEBUG.RENDER_ORDER;
  lines.frustumCulled = false;
  scene.add(lines);

  const radius = GAME_CONFIG.KIRO.RADIUS;
  const rectPair: RectPair = {
    top: { left: 0, right: 0, bottom: 0, top: 0 },
    bottom: { left: 0, right: 0, bottom: 0, top: 0 },
  };
  let cursor = 0;

  function segment(x1: number, y1: number, x2: number, y2: number): void {
    positions[cursor++] = x1;
    positions[cursor++] = y1;
    positions[cursor++] = PLANE_Z;
    positions[cursor++] = x2;
    positions[cursor++] = y2;
    positions[cursor++] = PLANE_Z;
  }

  function rect(r: ObstacleRect): void {
    segment(r.left, r.bottom, r.right, r.bottom);
    segment(r.right, r.bottom, r.right, r.top);
    segment(r.right, r.top, r.left, r.top);
    segment(r.left, r.top, r.left, r.bottom);
  }

  /** Rectangle dégénéré : tous les sommets au même point. */
  function degenerate(): void {
    for (let i = 0; i < SEGMENTS_PER_RECT; i++) segment(0, 0, 0, 0);
  }

  return {
    lines,
    update(world): void {
      cursor = 0;
      const step = (Math.PI * 2) / CIRCLE_SEGMENTS;
      for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
        const a0 = i * step;
        const a1 = (i + 1) * step;
        segment(
          world.kiro.x + Math.cos(a0) * radius,
          world.kiro.y + Math.sin(a0) * radius,
          world.kiro.x + Math.cos(a1) * radius,
          world.kiro.y + Math.sin(a1) * radius,
        );
      }

      const items = world.pool.items;
      for (let i = 0; i < poolSize; i++) {
        const o = items[i];
        if (o !== undefined && o.active) {
          obstacleRects(o, rectPair);
          rect(rectPair.top);
          rect(rectPair.bottom);
        } else {
          degenerate();
          degenerate();
        }
      }

      const w = GAME_CONFIG.WORLD;
      segment(w.LEFT, w.FLOOR, w.RIGHT, w.FLOOR);
      segment(w.LEFT, w.CEILING, w.RIGHT, w.CEILING);
      attribute.needsUpdate = true;
    },
    dispose(): void {
      scene.remove(lines);
      geometry.dispose();
      material.dispose();
    },
  };
}

export interface DebugOverlay {
  /** Synchronise contours et texte avec l'état du monde (lecture seule). */
  update(world: Readonly<World>, nowMs: number, stats: Readonly<FrameStats>): void;
  dispose(): void;
}

/**
 * Crée l'overlay de débogage, ou `null` si `debug` est faux (rien n'est créé : 10.5).
 * Les contours reprennent les données de collision à l'état courant, sans interpolation.
 */
export function createDebugOverlay(
  debug: boolean,
  scene: Scene,
  parentElement?: HTMLElement,
  getAudioInfo?: () => AudioDebugInfo | null,
): DebugOverlay | null {
  if (!debug) return null;
  const parent = parentElement ?? document.body;

  let outlines: HitboxOutlines | null = null;

  const element = document.createElement('div');
  element.setAttribute('data-testid', 'debug-overlay');
  element.style.cssText =
    'position:fixed;top:8px;left:8px;padding:4px 8px;white-space:pre;' +
    'font:12px monospace;pointer-events:none;background:rgba(0,0,0,0.5);' +
    `color:${PALETTE.DEBUG_TEXT};`;
  parent.appendChild(element);

  const meter = createFpsMeter();
  let lastMs = -1;
  let fps = 0;
  let lastText = '';

  return {
    update(world, nowMs, stats): void {
      outlines ??= createHitboxOutlines(world.pool.items.length, scene);
      if (lastMs >= 0 && nowMs > lastMs) fps = meter.push(nowMs - lastMs);
      lastMs = nowMs;

      outlines.update(world);

      const text =
        formatDebugText(fps, world.phase, world.score, world.rng.initialSeed, getAudioInfo?.()) +
        `\n${formatRenderStats(stats)}`;
      if (text !== lastText) {
        element.textContent = text;
        lastText = text;
      }
    },
    dispose(): void {
      outlines?.dispose();
      outlines = null;
      element.remove();
    },
  };
}
