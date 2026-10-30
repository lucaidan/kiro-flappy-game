import { ACESFilmicToneMapping, PCFShadowMap, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import { RENDER_CONFIG } from '../config/render.config';
import type { World } from '../game/state';
import { createDebugOverlay } from './debug/debug-overlay';
import type { AudioDebugInfo, FrameStats } from './debug/debug-overlay';
import { createRenderScene } from './scene';

const MS_PER_SECOND = 1000;
const MIN_PIXEL_RATIO = 1;
const MIN_SIZE = 1;

export interface GameRenderer {
  render(alpha: number): void;
  resize(): void;
  dispose(): void;
}

export interface Renderer2_5DOptions {
  canvas: HTMLCanvasElement;
  world: Readonly<World>;
  debug: boolean;
  /** Informations audio pour l'overlay de débogage (lecture seule). */
  getAudioInfo?: () => AudioDebugInfo | null;
  /** Horloge de rendu en millisecondes ; par défaut `performance.now`. */
  now?: () => number;
}

/** Paramètres du renderer touchés par la configuration (testables sans WebGL). */
export interface RendererSettings {
  outputColorSpace: string;
  toneMapping: number;
  shadowMap: { enabled: boolean; type: number };
  info: { autoReset: boolean };
}

/** Sortie sRGB, tone mapping ACES, ombres PCF, statistiques réinitialisées à la main. */
export function configureRenderer(target: RendererSettings): void {
  target.outputColorSpace = SRGBColorSpace;
  target.toneMapping = ACESFilmicToneMapping;
  target.shadowMap.enabled = true;
  target.shadowMap.type = PCFShadowMap;
  target.info.autoReset = false;
}

/** min(devicePixelRatio valide, MAX_PIXEL_RATIO), au moins 1. */
export function computePixelRatio(devicePixelRatio: number): number {
  const valid =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : MIN_PIXEL_RATIO;
  return Math.max(MIN_PIXEL_RATIO, Math.min(valid, RENDER_CONFIG.MAX_PIXEL_RATIO));
}

/** Seul module qui instancie le WebGLRenderer. Lecture seule de l'état du Moteur. */
export function createRenderer2_5D(options: Renderer2_5DOptions): GameRenderer {
  const { canvas, world, debug, getAudioInfo } = options;
  const now = options.now ?? ((): number => performance.now());

  const renderer = new WebGLRenderer({ canvas, antialias: true });
  configureRenderer(renderer);

  const renderScene = createRenderScene({ world });
  const overlayScene = new Scene();
  const overlay = createDebugOverlay(debug, overlayScene, undefined, getAudioInfo);

  // Statistiques de l'image précédente, affichées par l'overlay.
  const stats: FrameStats = {
    game: { calls: 0, triangles: 0 },
    overlay: { calls: 0, triangles: 0 },
  };

  function resize(): void {
    const width = Math.max(MIN_SIZE, canvas.clientWidth);
    const height = Math.max(MIN_SIZE, canvas.clientHeight);
    renderer.setPixelRatio(computePixelRatio(window.devicePixelRatio));
    renderer.setSize(width, height, false);
    renderScene.resize(width, height);
  }

  function render(alpha: number): void {
    const nowMs = now();
    renderScene.update(alpha, nowMs / MS_PER_SECOND);

    const info = renderer.info;
    info.reset();
    renderer.render(renderScene.scene, renderScene.camera);
    const gameCalls = info.render.calls;
    const gameTriangles = info.render.triangles;
    stats.game.calls = gameCalls;
    stats.game.triangles = gameTriangles;

    if (overlay !== null) {
      overlay.update(world, nowMs, stats);
      const previousAutoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.render(overlayScene, renderScene.camera);
      renderer.autoClear = previousAutoClear;
      stats.overlay.calls = info.render.calls - gameCalls;
      stats.overlay.triangles = info.render.triangles - gameTriangles;
    }
  }

  function dispose(): void {
    overlay?.dispose();
    renderScene.dispose();
    renderer.dispose();
  }

  resize();

  return { render, resize, dispose };
}
