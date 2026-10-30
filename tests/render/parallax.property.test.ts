import fc from 'fast-check';
import { Matrix4 } from 'three';
import { describe, it } from 'vitest';
import { GAME_CONFIG } from '../../src/config/game.config';
import { clampAlpha } from '../../src/render/interpolation';
import { RENDER_CONFIG } from '../../src/config/render.config';
import { computeCoverHalfWidth, computeProjection, createProjection } from '../../src/render/camera';
import { createBoundaries } from '../../src/render/environment/boundaries';
import { createParallaxLayers, parallaxOffset, scrollDistance } from '../../src/render/environment/parallax';

const distance = fc.double({ min: 1e-6, max: 1e6, noNaN: true });
const factor = fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true });
const period = fc.double({ min: 1e-3, max: 1e3, noNaN: true });

describe('parallax (property)', () => {
  // Feature: flappy-rendu-2-5d-m2, Property 13: Décalage de parallaxe
  it('Property 13: parallaxOffset = (distance × facteur) modulo période, dans [0, période[, périodique en période / facteur', () => {
    // **Validates: Requirements 6.4**
    fc.assert(
      fc.property(distance, factor, period, (d, f, p) => {
        const offset = parallaxOffset(d, f, p);
        if (offset < 0 || offset >= p) return false;
        if (offset !== (d * f) % p) return false;
        if (f > 1e-3) {
          const shifted = parallaxOffset(d + p / f, f, p);
          // Distance circulaire entre les deux décalages, tolérance flottante.
          const diff = Math.abs(shifted - offset);
          const circular = Math.min(diff, p - diff);
          if (circular > 1e-6 * Math.max(1, p, d * f)) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });

  // Feature: flappy-rendu-2-5d-m2, Property 14: Distance_Defilement
  it('Property 14: scrollDistance = (stepIndex + clampAlpha(alpha)) × SCROLL_SPEED × FIXED_DT, monotone', () => {
    // **Validates: Requirements 6.6**
    const alphaArb = fc.oneof(
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: -1e6, max: 1e6 }),
      fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
    );
    const stepArb = fc.integer({ min: 0, max: 1_000_000 });
    const k = GAME_CONFIG.SCROLL_SPEED * GAME_CONFIG.FIXED_DT;
    fc.assert(
      fc.property(stepArb, alphaArb, stepArb, alphaArb, (s1, a1, s2, a2) => {
        const d1 = scrollDistance(s1, a1);
        const d2 = scrollDistance(s2, a2);
        if (d1 !== (s1 + clampAlpha(a1)) * k) return false;
        const p1 = s1 + clampAlpha(a1);
        const p2 = s2 + clampAlpha(a2);
        if (p1 <= p2 && d1 > d2) return false;
        return d1 >= 0;
      }),
      { numRuns: 200 },
    );
  });

  // Feature: flappy-rendu-2-5d-m2, Property 15: Couverture continue du sol et du décor
  it('Property 15: les tuiles de chaque couche couvrent sans trou la demi-largeur requise ; sol/plafond dépassent la zone visible', () => {
    // **Validates: Requirements 5.3, 6.5, 6.8**
    const specs = [...RENDER_CONFIG.DECOR_LAYERS, RENDER_CONFIG.FOREGROUND];
    const centerX = (GAME_CONFIG.WORLD.LEFT + GAME_CONFIG.WORLD.RIGHT) / 2;
    const layers = createParallaxLayers();
    const boundaries = createBoundaries();
    const aspectArb = fc.double({ min: 0.2, max: RENDER_CONFIG.CAMERA.ASPECT_COVER_MAX, noNaN: true });
    const distArb = fc.double({ min: 0, max: 1e6, noNaN: true });
    try {
      fc.assert(
        fc.property(aspectArb, distArb, (aspect, d) => {
          const projection = createProjection();
          computeProjection(aspect, projection);
          layers.resize(projection);
          layers.update(d);
          let maxCover = 0;
          for (let i = 0; i < specs.length; i++) {
            const spec = specs[i]!;
            const mesh = layers.meshes[i]!;
            const cover = computeCoverHalfWidth(projection, spec.Z);
            maxCover = Math.max(maxCover, cover);
            if (mesh.count < 1) return false;
            const m = new Matrix4();
            const xs: number[] = [];
            for (let k = 0; k < mesh.count; k++) {
              mesh.getMatrixAt(k, m);
              xs.push(m.elements[12] as number);
            }
            // Matrices d'instance en Float32 : tolérance relative à l'amplitude des abscisses.
            const tol = 1e-5 * Math.max(1, cover + spec.PERIOD);
            for (let k = 1; k < xs.length; k++) {
              if (Math.abs((xs[k] as number) - (xs[k - 1] as number) - spec.PERIOD) > tol) return false;
            }
            const leftEdge = (xs[0] as number) - spec.PERIOD / 2;
            const rightEdge = (xs[xs.length - 1] as number) + spec.PERIOD / 2;
            if (leftEdge > centerX - cover + tol || rightEdge < centerX + cover - tol) return false;
          }
          boundaries.setHalfWidth(maxCover);
          const halfWidth = boundaries.floor.scale.x / 2;
          return halfWidth > 5.3 && boundaries.ceiling.scale.x / 2 === halfWidth && halfWidth >= computeCoverHalfWidth(projection, 0);
        }),
        { numRuns: 200 },
      );
    } finally {
      layers.dispose();
      boundaries.dispose();
    }
  });
});
