import fc from 'fast-check';
import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace } from 'three';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { RENDER_CONFIG } from '../../src/config/render.config';
import {
  computePixelRatio,
  configureRenderer,
  type GameRenderer,
  type RendererSettings,
} from '../../src/render/renderer';

/** Contrat minimal attendu par main.ts (anciennement TempRenderer). */
interface RendererContract {
  render(alpha: number): void;
  resize(): void;
  dispose(): void;
}

describe('computePixelRatio', () => {
  // Feature: flappy-rendu-2-5d-m2, Property 7: Ratio de pixels plafonné
  // **Validates: Requirements 2.6**
  it('reste dans [1, MAX_PIXEL_RATIO] pour tout devicePixelRatio', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.double({ noNaN: false }),
          fc.constantFrom(Number.NaN, 0, -1, Infinity, -Infinity, 1, 1.5, 2, 3),
        ),
        (dpr) => {
          const ratio = computePixelRatio(dpr);
          expect(ratio).toBeGreaterThanOrEqual(1);
          expect(ratio).toBeLessThanOrEqual(RENDER_CONFIG.MAX_PIXEL_RATIO);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('retombe sur 1 pour les valeurs invalides', () => {
    for (const bad of [Number.NaN, 0, -2, Infinity, -Infinity]) {
      expect(computePixelRatio(bad)).toBe(1);
    }
  });

  it('plafonne les écrans denses', () => {
    expect(computePixelRatio(3)).toBe(RENDER_CONFIG.MAX_PIXEL_RATIO);
    expect(computePixelRatio(1.5)).toBe(1.5);
  });
});

describe('configureRenderer', () => {
  // **Validates: Requirements 7.5**
  it('applique sRGB, ACES, ombres PCF et info.autoReset=false', () => {
    const fake: RendererSettings = {
      outputColorSpace: '',
      toneMapping: 0,
      shadowMap: { enabled: false, type: 0 },
      info: { autoReset: true },
    };
    configureRenderer(fake);
    expect(fake.outputColorSpace).toBe(SRGBColorSpace);
    expect(fake.toneMapping).toBe(ACESFilmicToneMapping);
    expect(fake.shadowMap.enabled).toBe(true);
    expect(fake.shadowMap.type).toBe(PCFShadowMap);
    expect(fake.info.autoReset).toBe(false);
  });
});

describe('GameRenderer', () => {
  // **Validates: Requirements 13.9**
  it('est compatible avec le contrat render/resize/dispose', () => {
    expectTypeOf<GameRenderer>().toMatchTypeOf<RendererContract>();
    expectTypeOf<RendererContract>().toMatchTypeOf<GameRenderer>();
  });
});
