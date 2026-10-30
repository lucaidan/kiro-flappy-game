import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PerspectiveCamera, Vector3 } from 'three';
import { GAME_CONFIG } from '../../src/config/game.config';
import { RENDER_CONFIG } from '../../src/config/render.config';
import {
  applyPose,
  applyProjection,
  computeCoverHalfWidth,
  computePose,
  computeProjection,
  createPerspectiveCamera,
  createPose,
  createProjection,
} from '../../src/render/camera';

const WORLD = GAME_CONFIG.WORLD;
const MARGIN = RENDER_CONFIG.VIEW_MARGIN;
const EPS = 1e-6;

const aspectArb = fc.double({ min: 0.2, max: 8, noNaN: true });
const kiroYArb = fc.double({ min: WORLD.FLOOR, max: WORLD.CEILING, noNaN: true });

// Feature: flappy-rendu-2-5d-m2, Property 1: Visibilité de la Zone_Jeu et marge
describe('Property 1: Visibilité de la Zone_Jeu et marge', () => {
  /**
   * **Validates: Requirements 2.1, 2.7**
   */
  it('les quatre coins de la Zone_Jeu agrandie de VIEW_MARGIN (z = 0) sont dans le NDC', () => {
    const camera: PerspectiveCamera = createPerspectiveCamera();
    const projection = createProjection();
    const pose = createPose();
    const corner = new Vector3();

    fc.assert(
      fc.property(aspectArb, kiroYArb, (aspect, kiroY) => {
        computeProjection(aspect, projection);
        computePose(projection, kiroY, pose);
        applyProjection(camera, projection);
        applyPose(camera, pose);
        camera.updateMatrixWorld(true);

        for (const x of [WORLD.LEFT - MARGIN, WORLD.RIGHT + MARGIN]) {
          for (const y of [WORLD.FLOOR - MARGIN, WORLD.CEILING + MARGIN]) {
            corner.set(x, y, 0).project(camera);
            expect(Math.abs(corner.x)).toBeLessThanOrEqual(1 + EPS);
            expect(Math.abs(corner.y)).toBeLessThanOrEqual(1 + EPS);
            // Devant la caméra : profondeur NDC dans [-1, 1].
            expect(Math.abs(corner.z)).toBeLessThanOrEqual(1 + EPS);
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});

const invalidAspectArb = fc.oneof(
  fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -0),
  fc.double({ min: -1e6, max: 0, noNaN: true }),
);

// Feature: flappy-rendu-2-5d-m2, Property 2: Repli d'un rapport d'aspect invalide
describe("Property 2: Repli d'un rapport d'aspect invalide", () => {
  /**
   * **Validates: Requirements 2.4**
   */
  it('un aspect invalide donne la même projection que FALLBACK_ASPECT, finie', () => {
    const actual = createProjection();
    const expected = createProjection();
    computeProjection(RENDER_CONFIG.CAMERA.FALLBACK_ASPECT, expected);

    fc.assert(
      fc.property(invalidAspectArb, (aspect) => {
        computeProjection(aspect, actual);
        expect(actual).toEqual(expected);
        for (const v of Object.values(actual)) {
          expect(Number.isFinite(v)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});

interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z: number;
}

/**
 * Applique `check` aux sommets de l'intersection entre un rectangle du plan `z = rect.z`
 * et la pyramide de vue (sans near ni far) : seuls les points visibles comptent.
 * La profondeur minimale et maximale d'un polygone convexe est atteinte à ces sommets.
 */
function checkVisibleRect(
  camera: PerspectiveCamera,
  tanH: number,
  tanV: number,
  check: (x: number, y: number, z: number) => void,
  rect: Rect,
): void {
  const TOL = 1e-9;
  const view = camera.matrixWorldInverse;
  const toCam = (x: number, y: number): Vector3 => new Vector3(x, y, rect.z).applyMatrix4(view);
  // Faces latérales : g(c) <= 0 à l'intérieur, avec depth = -c.z.
  const faces = [
    (c: Vector3): number => c.x - tanH * -c.z,
    (c: Vector3): number => -c.x - tanH * -c.z,
    (c: Vector3): number => c.y - tanV * -c.z,
    (c: Vector3): number => -c.y - tanV * -c.z,
  ];
  const inside = (c: Vector3): boolean =>
    -c.z > 0 && faces.every((g) => g(c) <= TOL * Math.max(1, Math.abs(c.z)));
  const corners: [number, number][] = [
    [rect.x0, rect.y0],
    [rect.x1, rect.y0],
    [rect.x1, rect.y1],
    [rect.x0, rect.y1],
  ];
  const candidates: [number, number][] = [...corners];
  // Croisements des bords du rectangle avec les faces de la pyramide (g linéaire le long d'un bord).
  for (let i = 0; i < 4; i++) {
    const a = corners[i] as [number, number];
    const b = corners[(i + 1) % 4] as [number, number];
    const ca = toCam(a[0], a[1]);
    const cb = toCam(b[0], b[1]);
    for (const g of faces) {
      const ga = g(ca);
      const gb = g(cb);
      if ((ga <= 0) !== (gb <= 0)) {
        const t = ga / (ga - gb);
        candidates.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
  }
  // Arêtes de la pyramide (rayons de coin) qui percent le rectangle.
  const origin = camera.position;
  const dir = new Vector3();
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      dir.set(sx * tanH, sy * tanV, -1).transformDirection(camera.matrixWorld);
      if (Math.abs(dir.z) < 1e-12) continue;
      const s = (rect.z - origin.z) / dir.z;
      if (s <= 0) continue;
      const x = origin.x + s * dir.x;
      const y = origin.y + s * dir.y;
      if (x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1) candidates.push([x, y]);
    }
  }
  for (const [x, y] of candidates) {
    if (inside(toCam(x, y))) check(x, y, rect.z);
  }
}

// Feature: flappy-rendu-2-5d-m2, Property 3: Plans proche et lointain englobants
describe('Property 3: Plans proche et lointain englobants', () => {
  const wideAspectArb = fc.oneof(aspectArb, fc.double({ min: 0.05, max: 40, noNaN: true }));
  const LAYERS = [...RENDER_CONFIG.DECOR_LAYERS, RENDER_CONFIG.FOREGROUND];
  const CENTER_X = (WORLD.LEFT + WORLD.RIGHT) / 2;

  /**
   * **Validates: Requirements 2.5**
   */
  it('Zone_Jeu, acteurs, bords et couches de décor sont entre near et far (profondeur sur l’axe de visée)', () => {
    const camera = createPerspectiveCamera();
    const projection = createProjection();
    const pose = createPose();
    const p = new Vector3();

    fc.assert(
      fc.property(wideAspectArb, kiroYArb, (aspect, kiroY) => {
        computeProjection(aspect, projection);
        computePose(projection, kiroY, pose);
        applyProjection(camera, projection);
        applyPose(camera, pose);
        camera.updateMatrixWorld(true);

        const check = (x: number, y: number, z: number): void => {
          p.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
          const depth = -p.z;
          expect(depth).toBeGreaterThanOrEqual(projection.near - EPS);
          expect(depth).toBeLessThanOrEqual(projection.far + EPS);
        };

        // Zone_Jeu agrandie, sur le Plan_Jeu, avec la profondeur des acteurs et des bords.
        const actorZs = [
          -RENDER_CONFIG.STELE.DEPTH,
          RENDER_CONFIG.STELE.RIM_Z_OFFSET,
          -RENDER_CONFIG.BOUNDARY.DEPTH,
          RENDER_CONFIG.KIRO.EYE_Z + RENDER_CONFIG.KIRO.EYE_RADIUS,
          0,
        ];
        for (const x of [WORLD.LEFT - MARGIN, WORLD.RIGHT + MARGIN]) {
          for (const y of [
            WORLD.FLOOR - RENDER_CONFIG.BOUNDARY.THICKNESS - MARGIN,
            WORLD.CEILING + RENDER_CONFIG.BOUNDARY.THICKNESS + MARGIN,
          ]) {
            for (const z of actorZs) check(x, y, z);
          }
        }

        // Couches de décor et premier plan : partie visible de l'étendue des tuiles
        // (couverture + demi-période), extrémités verticales de la couche.
        const tanV = Math.tan((projection.fovDeg * Math.PI) / 360);
        const tanH = tanV * projection.aspect;
        for (const layer of LAYERS) {
          const half = computeCoverHalfWidth(projection, layer.Z) + layer.PERIOD / 2;
          checkVisibleRect(camera, tanH, tanV, check, {
            x0: CENTER_X - half,
            x1: CENTER_X + half,
            y0: layer.BASE_Y,
            y1: layer.BASE_Y + layer.HEIGHT,
            z: layer.Z,
          });
        }
        // Sol et plafond sur toute la largeur couverte, à l'avant et à l'arrière.
        const T = RENDER_CONFIG.BOUNDARY.THICKNESS;
        for (const z of [0, -RENDER_CONFIG.BOUNDARY.DEPTH]) {
          const half = computeCoverHalfWidth(projection, z);
          for (const [y0, y1] of [
            [WORLD.FLOOR - T, WORLD.FLOOR],
            [WORLD.CEILING, WORLD.CEILING + T],
          ] as const) {
            checkVisibleRect(camera, tanH, tanV, check, { x0: CENTER_X - half, x1: CENTER_X + half, y0, y1, z });
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});

