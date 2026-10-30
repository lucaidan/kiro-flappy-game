import { describe, expect, it } from 'vitest';
import { LineBasicMaterial, Scene } from 'three';
import { RENDER_CONFIG } from '../src/config/render.config';
import { GAME_CONFIG } from '../src/config/game.config';
import { createEventBus } from '../src/core/events';
import { createWorld } from '../src/game/state';
import {
  createDebugOverlay,
  createFpsMeter,
  createHitboxOutlines,
  formatDebugText,
  formatRenderStats,
} from '../src/render/debug/debug-overlay';

const POOL = GAME_CONFIG.POOL_SIZE;
function makeWorld(): ReturnType<typeof createWorld> {
  return createWorld({ seed: 1, muted: true, bus: createEventBus() });
}

describe('debug overlay', () => {
  it('ne crée rien quand debug est faux (11.3)', () => {
    const scene = new Scene();
    expect(createDebugOverlay(false, scene)).toBeNull();
    expect(scene.children.length).toBe(0);
  });

  it('FPS : moyenne glissante sur 60 frames', () => {
    const m = createFpsMeter(60);
    for (let i = 0; i < 60; i++) m.push(100);
    expect(m.push(10)).toBeCloseTo(1000 / ((59 * 100 + 10) / 60), 5);
  });

  it('formate les statistiques de rendu séparément (10.4)', () => {
    const t = formatRenderStats({
      game: { calls: 12, triangles: 3400 },
      overlay: { calls: 1, triangles: 60 },
    });
    expect(t).toBe('Appels : 12 (+1 debug), Triangles : 3400 (+60 debug)');
  });

  it('contours : un seul LineSegments dans le plan z=0, sans depth, retiré au dispose (10.1-10.3)', () => {
    const scene = new Scene();
    const out = createHitboxOutlines(POOL, scene);
    expect(scene.children).toEqual([out.lines]);
    const mat = out.lines.material as LineBasicMaterial;
    expect(mat.depthTest).toBe(false);
    expect(mat.depthWrite).toBe(false);
    expect(out.lines.renderOrder).toBe(RENDER_CONFIG.DEBUG.RENDER_ORDER);
    const world = makeWorld();
    out.update(world);
    const pos = out.lines.geometry.getAttribute('position');
    expect(pos.count).toBe((RENDER_CONFIG.DEBUG.CIRCLE_SEGMENTS + POOL * 8 + 2) * 2);
    for (let i = 0; i < pos.count; i++) expect(pos.getZ(i)).toBe(0);
    out.dispose();
    expect(scene.children.length).toBe(0);
  });

  it('affiche les deux séries de chiffres avec d\'autres valeurs (10.4, 12.5)', () => {
    const t = formatRenderStats({
      game: { calls: 5, triangles: 800 },
      overlay: { calls: 2, triangles: 130 },
    });
    expect(t).toContain('5');
    expect(t).toContain('800');
    expect(t).toContain('+2 debug');
    expect(t).toContain('+130 debug');
  });

  it('createDebugOverlay(false) renvoie null et laisse la scène vide (10.5)', () => {
    const scene = new Scene();
    expect(createDebugOverlay(false, scene)).toBeNull();
    expect(scene.children).toHaveLength(0);
  });

  it('un Obstacle inactif n\'a aucun segment non nul ; tout est à z=0 (10.2)', () => {
    const scene = new Scene();
    const out = createHitboxOutlines(POOL, scene);
    const world = makeWorld();
    out.update(world);
    const pos = out.lines.geometry.getAttribute('position');
    const first = RENDER_CONFIG.DEBUG.CIRCLE_SEGMENTS * 2;
    const last = first + POOL * 8 * 2;
    for (let i = first; i < last; i++) {
      expect(pos.getX(i)).toBe(0);
      expect(pos.getY(i)).toBe(0);
      expect(pos.getZ(i)).toBe(0);
    }
    out.dispose();
  });

  it('FPS : fenêtre limitée à 60 frames, moyenne partielle avant (11.2)', () => {
    const m = createFpsMeter(60);
    expect(m.push(20)).toBeCloseTo(50, 5);
    expect(m.push(10)).toBeCloseTo(1000 / 15, 5);
    const m2 = createFpsMeter(60);
    for (let i = 0; i < 200; i++) m2.push(1000);
    let fps = 0;
    for (let i = 0; i < 60; i++) fps = m2.push(10);
    expect(fps).toBeCloseTo(100, 5);
  });

  it('ajoute la ligne audio quand l\'information est fournie (5.3)', () => {
    const t = formatDebugText(60, 'Playing', 1, 7, {
      bpm: 120,
      beatIndex: 42,
      scrollSpeed: 5.5,
      queueSize: 1,
    });
    expect(t.split('\n').pop()).toBe('BPM: 120 | Temps: 42 | Vitesse: 5.50 | File: 1');
  });

  it('sans information audio, le texte M2 est inchangé (5.3)', () => {
    const base = formatDebugText(60, 'Playing', 1, 7);
    expect(base).not.toContain('BPM');
    expect(formatDebugText(60, 'Playing', 1, 7, null)).toBe(base);
  });

  it('formate état, score et graine', () => {
    const t = formatDebugText(59.6, 'Playing', 3, 42);
    expect(t).toContain('FPS: 60');
    expect(t).toContain('Playing');
    expect(t).toContain('Score: 3');
    expect(t).toContain('Graine: 42');
  });
});
