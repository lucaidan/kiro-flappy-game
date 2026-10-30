import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { circleHitsRect, hitsBounds } from '../../src/game/collision';
import type { Circle, Rect } from '../../src/game/collision';

const TOL = 1e-9;
const num = (min: number, max: number) => fc.double({ min, max, noNaN: true });

const rectArb: fc.Arbitrary<Rect> = fc
  .record({ x: num(-10, 10), w: num(0.1, 5), y: num(-10, 10), h: num(0.1, 8) })
  .map(({ x, w, y, h }) => ({ left: x, right: x + w, bottom: y, top: y + h }));

const sceneArb = fc.record({
  circle: fc.record({ x: num(-10, 10), y: num(-10, 10), r: num(0.05, 2) }),
  rects: fc.array(rectArb, { maxLength: 6 }),
  floor: num(-8, 0),
  height: num(1, 16),
});

function reflectCircle(c: Circle): Circle {
  return { x: c.x, y: -c.y, r: c.r };
}

function reflectRect(r: Rect): Rect {
  return { left: r.left, right: r.right, bottom: -r.top, top: -r.bottom };
}

/** Distance signée au carré moins r² : proche de 0 = quasi tangent. */
function rectMargin(c: Circle, r: Rect): number {
  const dx = c.x - Math.max(r.left, Math.min(c.x, r.right));
  const dy = c.y - Math.max(r.bottom, Math.min(c.y, r.top));
  return Math.abs(Math.hypot(dx, dy) - c.r);
}

describe('Property 15: Symétrie de la collision par réflexion verticale', () => {
  it('le résultat est identique avant et après réflexion verticale (tolérance 1e-9)', () => {
    fc.assert(
      fc.property(sceneArb, ({ circle, rects, floor, height }) => {
        const ceiling = floor + height;

        // Écarter les cas quasi tangents (dans la tolérance 1e-9).
        const margins = [
          ...rects.map((r) => rectMargin(circle, r)),
          Math.abs(circle.y - circle.r - floor),
          Math.abs(circle.y + circle.r - ceiling),
        ];
        fc.pre(margins.every((m) => m > TOL));

        const original =
          hitsBounds(circle, floor, ceiling) || rects.some((r) => circleHitsRect(circle, r));

        const mc = reflectCircle(circle);
        const reflected =
          hitsBounds(mc, -ceiling, -floor) ||
          rects.some((r) => circleHitsRect(mc, reflectRect(r)));

        expect(reflected).toBe(original);
      }),
      { numRuns: 200 },
    );
  });
});
