import { describe, it, expect } from 'vitest';
import { RENDER_CONFIG } from '../../src/config/render.config';
import { PALETTE } from '../../src/config/palette';
import { GAME_CONFIG } from '../../src/config/game.config';

function collectLeaves(value: unknown, path = 'RENDER_CONFIG'): [string, unknown][] {
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => collectLeaves(v, `${path}[${i}]`));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([k, v]) => collectLeaves(v, `${path}.${k}`));
  }
  return [[path, value]];
}

describe('RENDER_CONFIG', () => {
  it('toutes les feuilles sont des nombres finis ou des chaînes (13.1)', () => {
    for (const [path, leaf] of collectLeaves(RENDER_CONFIG)) {
      const ok = typeof leaf === 'string' || typeof leaf === 'boolean' || (typeof leaf === 'number' && Number.isFinite(leaf));
      expect(ok, path).toBe(true);
    }
  });

  it('budgets de dessin positifs', () => {
    expect(RENDER_CONFIG.MAX_DRAW_CALLS).toBeGreaterThan(0);
    expect(RENDER_CONFIG.MAX_TRIANGLES).toBeGreaterThan(0);
  });

  it('FOV dans [35, 45] (1.1)', () => {
    expect(RENDER_CONFIG.FOV_DEG).toBeGreaterThanOrEqual(35);
    expect(RENDER_CONFIG.FOV_DEG).toBeLessThanOrEqual(45);
  });

  it('lacet et tangage dans ]0, TILT_MAX_DEG] (1.2)', () => {
    const { YAW_DEG, PITCH_DEG, TILT_MAX_DEG } = RENDER_CONFIG.CAMERA;
    for (const angle of [YAW_DEG, PITCH_DEG]) {
      expect(angle).toBeGreaterThan(0);
      expect(angle).toBeLessThanOrEqual(TILT_MAX_DEG);
    }
  });

  it('FOLLOW_Y dans [0, 0.5] (1.4)', () => {
    expect(RENDER_CONFIG.FOLLOW_Y).toBeGreaterThanOrEqual(0);
    expect(RENDER_CONFIG.FOLLOW_Y).toBeLessThanOrEqual(0.5);
  });

  it('SHADOW.MAP_SIZE <= SHADOW_MAP_SIZE_MAX (7.3)', () => {
    expect(RENDER_CONFIG.SHADOW.MAP_SIZE).toBeLessThanOrEqual(RENDER_CONFIG.SHADOW_MAP_SIZE_MAX);
  });

  it('parallaxe dans [0, 1[ et strictement décroissante avec la profondeur (6.3)', () => {
    const layers = [...RENDER_CONFIG.DECOR_LAYERS].sort((a, b) => a.Z - b.Z); // du plus profond au plus proche
    for (const layer of layers) {
      expect(layer.PARALLAX).toBeGreaterThanOrEqual(0);
      expect(layer.PARALLAX).toBeLessThan(1);
    }
    for (let i = 1; i < layers.length; i++) {
      expect(layers[i - 1]!.PARALLAX).toBeLessThan(layers[i]!.PARALLAX);
    }
  });

  it('profondeurs z < 0 distinctes (6.1)', () => {
    const zs = RENDER_CONFIG.DECOR_LAYERS.map((l) => l.Z);
    for (const z of zs) expect(z).toBeLessThan(0);
    expect(new Set(zs).size).toBe(zs.length);
  });

  it('sommet du premier plan <= sol + FOREGROUND_MAX_HEIGHT (6.2)', () => {
    const { BASE_Y, HEIGHT } = RENDER_CONFIG.FOREGROUND;
    const limit = GAME_CONFIG.WORLD.FLOOR + RENDER_CONFIG.FOREGROUND_MAX_HEIGHT;
    expect(BASE_Y + HEIGHT).toBeLessThanOrEqual(limit + 1e-9);
  });

  it('chaque COLOR de couche nomme une clé de PALETTE', () => {
    const layers = [...RENDER_CONFIG.DECOR_LAYERS, RENDER_CONFIG.FOREGROUND];
    for (const layer of layers) expect(PALETTE).toHaveProperty(layer.COLOR);
  });
});

describe('PALETTE', () => {
  it('contient toutes les clés requises (11.1)', () => {
    const required = [
      'BACKGROUND',
      'KIRO',
      'KIRO_EYE',
      'KIRO_HALO',
      'KIRO_TRAIL',
      'KIRO_LIGHT',
      'STELE_BODY',
      'STELE_CAP',
      'STELE_RIM',
      'FLOOR',
      'CEILING',
      'DECOR_SKY',
      'DECOR_FAR',
      'DECOR_MID',
      'DECOR_FOREGROUND',
      'FOG',
      'LIGHT_HEMI_SKY',
      'LIGHT_HEMI_GROUND',
      'LIGHT_MOON',
      'SHADOW',
      'DEBUG_HITBOX',
      'DEBUG_TEXT',
    ];
    for (const key of required) expect(PALETTE, key).toHaveProperty(key);
  });
});
