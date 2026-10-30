import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../../src/config/game.config';
import { RENDER_CONFIG } from '../../src/config/render.config';
import {
  createParallaxLayers,
  layerTileCount,
  scrollDistance,
  tileCenterX,
} from '../../src/render/environment/parallax';

const EPSILON = 1e-9;

describe('parallax config (6.1, 6.2, 6.3)', () => {
  it('has at least 3 decor layers at distinct z < 0', () => {
    const zs = RENDER_CONFIG.DECOR_LAYERS.map((layer) => layer.Z);
    expect(zs.length).toBeGreaterThanOrEqual(3);
    for (const z of zs) expect(z).toBeLessThan(0);
    expect(new Set(zs).size).toBe(zs.length);
  });

  it('places the foreground at z > 0 with its top under FLOOR + FOREGROUND_MAX_HEIGHT', () => {
    const fg = RENDER_CONFIG.FOREGROUND;
    expect(fg.Z).toBeGreaterThan(0);
    const top = fg.BASE_Y + fg.HEIGHT;
    expect(top).toBeLessThanOrEqual(GAME_CONFIG.WORLD.FLOOR + RENDER_CONFIG.FOREGROUND_MAX_HEIGHT + EPSILON);
  });

  it('uses strictly decreasing factors in [0, 1[ with depth', () => {
    const layers = [...RENDER_CONFIG.DECOR_LAYERS].sort((a, b) => a.Z - b.Z);
    for (const layer of layers) {
      expect(layer.PARALLAX).toBeGreaterThanOrEqual(0);
      expect(layer.PARALLAX).toBeLessThan(1);
    }
    for (let i = 1; i < layers.length; i++) {
      expect((layers[i - 1] as (typeof layers)[number]).PARALLAX).toBeLessThan(
        (layers[i] as (typeof layers)[number]).PARALLAX,
      );
    }
  });
});

describe('tile helpers', () => {
  it('tileCenterX = origin + index × period − offset', () => {
    expect(tileCenterX(0, -10, 4, 1)).toBe(-11);
    expect(tileCenterX(3, -10, 4, 1)).toBe(1);
    expect(tileCenterX(2, 5, 0.5, 0)).toBe(6);
  });

  it('layerTileCount = ceil(2 × cover / period) + 2', () => {
    expect(layerTileCount(10, 5)).toBe(6);
    expect(layerTileCount(10, 6)).toBe(6);
    expect(layerTileCount(0, 5)).toBe(2);
  });
});

describe('scrollDistance (6.8)', () => {
  it('returns 0 at stepIndex 0 with alpha 0', () => {
    expect(scrollDistance(0, 0)).toBe(0);
  });

  it('does not throw at stepIndex 0 and scales with alpha', () => {
    expect(() => scrollDistance(0, 0.5)).not.toThrow();
    expect(scrollDistance(0, 1)).toBeCloseTo(GAME_CONFIG.SCROLL_SPEED * GAME_CONFIG.FIXED_DT, 12);
  });
});

describe('createParallaxLayers update (6.7, 6.8)', () => {
  it('does not throw when updated at distance 0', () => {
    const layers = createParallaxLayers();
    expect(() => layers.update(scrollDistance(0, 0))).not.toThrow();
    layers.dispose();
  });

  it('does not write matrices when the distance is unchanged', () => {
    const layers = createParallaxLayers();
    layers.update(3.5);
    const versions = layers.meshes.map((m) => m.instanceMatrix.version);
    const contents = layers.meshes.map((m) => Array.from(m.instanceMatrix.array));

    layers.update(3.5);

    layers.meshes.forEach((m, i) => {
      expect(m.instanceMatrix.version).toBe(versions[i]);
      expect(Array.from(m.instanceMatrix.array)).toEqual(contents[i]);
    });
    layers.dispose();
  });

  it('writes matrices when the distance changes', () => {
    const layers = createParallaxLayers();
    layers.update(1);
    const versions = layers.meshes.map((m) => m.instanceMatrix.version);
    layers.update(2);
    layers.meshes.forEach((m, i) => {
      expect(m.instanceMatrix.version).toBeGreaterThan(versions[i] as number);
    });
    layers.dispose();
  });
});
