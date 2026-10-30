import fc from 'fast-check';
import { Matrix4, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../../src/config/game.config';
import { RENDER_CONFIG } from '../../src/config/render.config';
import { createPool, obstacleRects } from '../../src/game/obstacles';
import type { RectPair } from '../../src/game/obstacles';
import { createTombstones, splitSteleHeight } from '../../src/render/actors/tombstones';
import { clampAlpha } from '../../src/render/interpolation';
import type { SteleSplit } from '../../src/render/actors/tombstones';

const { FLOOR, CEILING } = GAME_CONFIG.WORLD;
const CAP = RENDER_CONFIG.CAP_HEIGHT;

describe('tombstones (property)', () => {
  // Feature: flappy-rendu-2-5d-m2, Property 11: DÃ©coupage corps-chapiteau
  it('Property 11: cap = min(CAP_HEIGHT, h), body = h - cap, cap + body = h, cap et body >= 0', () => {
    // **Validates: Requirements 4.4**
    fc.assert(
      fc.property(fc.double({ min: 0, max: CEILING - FLOOR, noNaN: true }), (h) => {
        const out: SteleSplit = { cap: -1, body: -1 };
        splitSteleHeight(h, out);
        expect(out.cap).toBe(Math.min(CAP, h));
        expect(out.body).toBe(h - out.cap);
        expect(out.cap + out.body).toBeCloseTo(h, 9);
        expect(out.cap).toBeGreaterThanOrEqual(0);
        expect(out.body).toBeGreaterThanOrEqual(0);
        expect(out.cap).toBeLessThanOrEqual(CAP);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: flappy-rendu-2-5d-m2, Property 12: Alignement et interpolation des Stèles
  it('Property 12: l union corps+chapiteau coïncide avec obstacleRects à x interpolé, face avant à z = 0, inactifs à échelle nulle', () => {
    // **Validates: Requirements 4.3, 4.6, 4.7, 4.8**
    const TOL = RENDER_CONFIG.HITBOX_ALIGN_TOLERANCE;
    const { LEFT, RIGHT } = GAME_CONFIG.WORLD;
    const half = GAME_CONFIG.OBSTACLE.GAP_HEIGHT / 2;
    const size = GAME_CONFIG.POOL_SIZE;
    const obstacleArb = fc.record({
      active: fc.boolean(),
      x: fc.double({ min: LEFT, max: RIGHT, noNaN: true }),
      prevX: fc.double({ min: LEFT, max: RIGHT, noNaN: true }),
      gapCenterY: fc.double({ min: FLOOR + half + 0.05, max: CEILING - half - 0.05, noNaN: true }),
    });
    const alphaArb = fc.oneof(
      fc.double({ min: -2, max: 3 }),
      fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
    );
    const tombs = createTombstones(size);
    const m = new Matrix4();
    const pos = new Vector3();
    const scl = new Vector3();
    const rects: RectPair = {
      top: { left: 0, right: 0, bottom: 0, top: 0 },
      bottom: { left: 0, right: 0, bottom: 0, top: 0 },
    };
    const boxOf = (mesh: InstancedMesh, i: number) => {
      mesh.getMatrixAt(i, m);
      pos.setFromMatrixPosition(m);
      scl.setFromMatrixScale(m);
      return {
        hidden: scl.x === 0 && scl.y === 0 && scl.z === 0,
        left: pos.x - scl.x / 2,
        right: pos.x + scl.x / 2,
        bottom: pos.y - scl.y / 2,
        top: pos.y + scl.y / 2,
        zFront: pos.z,
        zBack: pos.z - scl.z,
      };
    };
    try {
      fc.assert(
        fc.property(fc.array(obstacleArb, { minLength: size, maxLength: size }), alphaArb, (list, alpha) => {
          const pool = createPool(size);
          list.forEach((o, i) => Object.assign(pool.items[i] ?? {}, o));
          tombs.update(pool, alpha);
          list.forEach((o, i) => {
            const parts = [0, 1].flatMap((k) => [boxOf(tombs.bodies, 2 * i + k), boxOf(tombs.caps, 2 * i + k)]);
            if (!o.active) {
              for (const p of parts) expect(p.hidden).toBe(true);
              return;
            }
            const x = o.prevX + (o.x - o.prevX) * clampAlpha(alpha);
            obstacleRects({ active: true, x, prevX: x, gapCenterY: o.gapCenterY, passed: false }, rects);
            [rects.bottom, rects.top].forEach((r, k) => {
              const body = boxOf(tombs.bodies, 2 * i + k);
              const cap = boxOf(tombs.caps, 2 * i + k);
              // Un sous-élément de hauteur nulle (corps si h <= CAP_HEIGHT) peut être masqué.
              const visible = [body, cap].filter((p) => !p.hidden);
              expect(visible.length).toBeGreaterThan(0);
              for (const p of visible) {
                expect(Math.abs(p.zFront)).toBeLessThanOrEqual(TOL);
                expect(Math.abs(p.left - r.left)).toBeLessThanOrEqual(TOL);
                expect(Math.abs(p.right - r.right)).toBeLessThanOrEqual(TOL);
              }
              const bottom = Math.min(...visible.map((p) => p.bottom));
              const top = Math.max(...visible.map((p) => p.top));
              expect(Math.abs(bottom - r.bottom)).toBeLessThanOrEqual(TOL);
              expect(Math.abs(top - r.top)).toBeLessThanOrEqual(TOL);
              // Pas de trou entre corps et chapiteau.
              if (visible.length === 2) {
                expect(Math.abs(body.top - cap.bottom) <= TOL || Math.abs(cap.top - body.bottom) <= TOL).toBe(true);
              }
            });
          });
        }),
        { numRuns: 200 },
      );
    } finally {
      tombs.dispose();
    }
  });
});

