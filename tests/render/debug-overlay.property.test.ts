import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { Scene } from 'three';
import { GAME_CONFIG } from '../../src/config/game.config';
import { RENDER_CONFIG } from '../../src/config/render.config';
import { createEventBus } from '../../src/core/events';
import { obstacleRects } from '../../src/game/obstacles';
import type { RectPair } from '../../src/game/obstacles';
import { createWorld } from '../../src/game/state';
import { createHitboxOutlines } from '../../src/render/debug/debug-overlay';

const POOL = GAME_CONFIG.POOL_SIZE;
const CIRCLE = RENDER_CONFIG.DEBUG.CIRCLE_SEGMENTS;
const W = GAME_CONFIG.WORLD;
const f = Math.fround;

const obstacleArb = fc.record({
  active: fc.boolean(),
  x: fc.double({ min: -50, max: 50, noNaN: true }),
  gapCenterY: fc.double({ min: -20, max: 20, noNaN: true }),
});

// Feature: flappy-rendu-2-5d-m2, Property 19: Alignement des contours de débogage
describe('Property 19: Alignement des contours de débogage', () => {
  it('les sommets des contours coïncident avec Kiro, les rectangles, le sol et le plafond, dans z=0', () => {
    // **Validates: Requirements 10.1, 10.3, 10.6**
    fc.assert(
      fc.property(
        fc.double({ min: -30, max: 30, noNaN: true }),
        fc.double({ min: -30, max: 30, noNaN: true }),
        fc.array(obstacleArb, { minLength: POOL, maxLength: POOL }),
        (kx, ky, obstacles) => {
          const world = createWorld({ seed: 1, muted: true, bus: createEventBus() });
          world.kiro.x = kx;
          world.kiro.y = ky;
          obstacles.forEach((src, i) => {
            const o = world.pool.items[i];
            if (o === undefined) return;
            o.active = src.active;
            o.x = src.x;
            o.gapCenterY = src.gapCenterY;
          });

          const out = createHitboxOutlines(POOL, new Scene());
          out.update(world);
          const pos = out.lines.geometry.getAttribute('position');
          const v = (i: number): [number, number, number] => [pos.getX(i), pos.getY(i), pos.getZ(i)];

          for (let i = 0; i < pos.count; i++) expect(pos.getZ(i)).toBe(0);

          // Cercle de Kiro
          const r = GAME_CONFIG.KIRO.RADIUS;
          const step = (Math.PI * 2) / CIRCLE;
          for (let s = 0; s < CIRCLE; s++) {
            expect(v(2 * s)[0]).toBe(f(kx + Math.cos(s * step) * r));
            expect(v(2 * s)[1]).toBe(f(ky + Math.sin(s * step) * r));
            expect(v(2 * s + 1)[0]).toBe(f(kx + Math.cos((s + 1) * step) * r));
            expect(v(2 * s + 1)[1]).toBe(f(ky + Math.sin((s + 1) * step) * r));
          }

          // Rectangles des obstacles
          const pair: RectPair = {
            top: { left: 0, right: 0, bottom: 0, top: 0 },
            bottom: { left: 0, right: 0, bottom: 0, top: 0 },
          };
          let vi = CIRCLE * 2;
          for (let k = 0; k < POOL; k++) {
            const o = world.pool.items[k];
            if (o === undefined) throw new Error('pool');
            if (o.active) obstacleRects(o, pair);
            for (const rect of [pair.top, pair.bottom]) {
              for (let s = 0; s < 4; s++) {
                for (let e = 0; e < 2; e++) {
                  const [x, y] = v(vi++);
                  if (!o.active) {
                    expect([x, y]).toEqual([0, 0]);
                    continue;
                  }
                  const corners = [
                    [rect.left, rect.bottom],
                    [rect.right, rect.bottom],
                    [rect.right, rect.top],
                    [rect.left, rect.top],
                    [rect.left, rect.bottom],
                  ];
                  const c = corners[s + e];
                  expect([x, y]).toEqual([f(c?.[0] ?? NaN), f(c?.[1] ?? NaN)]);
                }
              }
            }
          }

          // Sol et plafond
          expect(v(vi++).slice(0, 2)).toEqual([f(W.LEFT), f(W.FLOOR)]);
          expect(v(vi++).slice(0, 2)).toEqual([f(W.RIGHT), f(W.FLOOR)]);
          expect(v(vi++).slice(0, 2)).toEqual([f(W.LEFT), f(W.CEILING)]);
          expect(v(vi++).slice(0, 2)).toEqual([f(W.RIGHT), f(W.CEILING)]);
          expect(vi).toBe(pos.count);
          out.dispose();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('smoke: le fichier est exécuté', () => {
    expect(POOL).toBeGreaterThan(0);
  });
});
