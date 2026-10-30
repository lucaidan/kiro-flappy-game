import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { Group, InstancedMesh } from 'three';
import type { BufferGeometry, Light, Material, Mesh, Object3D } from 'three';
import { createEventBus } from '../../src/core/events';
import type { GameEvents, GameStateName } from '../../src/core/events';
import { createWorld } from '../../src/game/state';
import { createRenderScene } from '../../src/render/scene';
import { createDebugOverlay } from '../../src/render/debug/debug-overlay';
import type { World } from '../../src/game/state';

const alphaArb = fc.double({ noNaN: false });
const nowStepsArb = fc.array(fc.double({ min: 0, max: 5, noNaN: true }), {
  minLength: 2,
  maxLength: 12,
});
const alphasArb = fc.array(alphaArb, { minLength: 2, maxLength: 12 });
const frozenPhaseArb = fc.constantFrom<GameStateName>('Paused', 'GameOver', 'Title');

interface Snapshot {
  group: number[];
  camera: number[];
  parallax: number[];
}

function snapshot(rs: ReturnType<typeof createRenderScene>): Snapshot {
  const ghost = rs.scene.children.find(
    (c): c is Group => c instanceof Group && c.children.length === 4,
  );
  if (!ghost) throw new Error('groupe Kiro introuvable');
  const parallax: number[] = [];
  for (const obj of rs.scene.children) {
    if (obj instanceof InstancedMesh && obj.count > 0 && obj.position.z <= 0) {
      // Les tombes sont couvertes ailleurs ; on retient toutes les instances compt�es.
      parallax.push(...Array.from(obj.instanceMatrix.array.slice(0, obj.count * 16)));
    }
  }
  return {
    group: [
      ghost.position.x,
      ghost.position.y,
      ghost.position.z,
      ghost.rotation.x,
      ghost.rotation.y,
      ghost.rotation.z,
    ],
    camera: [
      ...rs.camera.position.toArray(),
      ...rs.camera.quaternion.toArray(),
      ...rs.camera.projectionMatrix.toArray(),
    ],
    parallax,
  };
}

// Feature: flappy-rendu-2-5d-m2, Property 16: Gel hors Playing
describe('Property 16: Gel hors Playing', () => {
  /**
   * **Validates: Requirements 1.5, 3.7, 3.8, 6.7, 8.4**
   */
  it('Paused/GameOver : tout est gel� ; Title : idem', () => {
    fc.assert(
      fc.property(
        frozenPhaseArb,
        alphasArb,
        nowStepsArb,
        fc.double({ min: -50, max: 50, noNaN: true }),
        fc.double({ min: -50, max: 50, noNaN: true }),
        fc.integer({ min: 0, max: 100000 }),
        (phase, alphas, steps, y, prevY, stepIndex) => {
          const world = createWorld({
            seed: 1,
            muted: false,
            bus: createEventBus<GameEvents>(),
          });
          world.kiro.y = y;
          world.kiro.prevY = prevY;
          world.stepIndex = stepIndex;
          world.phase = phase;
          const rs = createRenderScene({ world });
          try {
            let now = 0;
            let ref: Snapshot | undefined;
            const n = Math.min(alphas.length, steps.length);
            for (let i = 0; i < n; i++) {
              now += steps[i] as number;
              rs.update(alphas[i] as number, now);
              const snap = snapshot(rs);
              if (!ref) {
                ref = snap;
                continue;
              }
              expect(snap.group).toEqual(ref.group);
              expect(snap.camera).toEqual(ref.camera);
              expect(snap.parallax).toEqual(ref.parallax);
            }
          } finally {
            rs.dispose();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

/** Instantan� profond de l'Etat_Moteur (copie de tous les champs, bus exclu : r�f�rence). */
function worldSnapshot(world: World): unknown {
  return {
    phase: world.phase,
    kiro: { ...world.kiro },
    pool: world.pool.items.map((o) => ({ ...o })),
    poolLength: world.pool.items.length,
    score: world.score,
    activatedCount: world.activatedCount,
    distanceSinceSpawn: world.distanceSinceSpawn,
    stepIndex: world.stepIndex,
    muted: world.muted,
    flapPending: world.flapPending,
    rngSeed: world.rng.initialSeed,
    rngState: world.rng.getState(),
  };
}

function deepFreezeWorld(world: World): void {
  Object.freeze(world.kiro);
  for (const o of world.pool.items) Object.freeze(o);
  Object.freeze(world.pool.items);
  Object.freeze(world.pool);
  Object.freeze(world);
}

const finite = (min: number, max: number): fc.Arbitrary<number> =>
  fc.double({ min, max, noNaN: true });

const obstacleArb = fc.record({
  active: fc.boolean(),
  x: finite(-20, 40),
  prevX: finite(-20, 40),
  gapCenterY: finite(-10, 10),
  passed: fc.boolean(),
});

const worldSpecArb = fc.record({
  phase: fc.constantFrom<GameStateName>('Title', 'Playing', 'Paused', 'GameOver'),
  kiro: fc.record({
    y: finite(-50, 50),
    vy: finite(-50, 50),
    prevY: finite(-50, 50),
    prevVy: finite(-50, 50),
  }),
  items: fc.array(obstacleArb, { minLength: 0, maxLength: 64 }),
  score: fc.integer({ min: 0, max: 100000 }),
  activatedCount: fc.integer({ min: 0, max: 100000 }),
  distanceSinceSpawn: finite(0, 100),
  stepIndex: fc.integer({ min: 0, max: 1000000 }),
  muted: fc.boolean(),
  flapPending: fc.boolean(),
  seed: fc.integer({ min: 0, max: 0xffffffff }),
  draws: fc.integer({ min: 0, max: 20 }),
});

type WorldSpec = typeof worldSpecArb extends fc.Arbitrary<infer T> ? T : never;

function buildWorld(spec: WorldSpec): World {
  const world = createWorld({ seed: spec.seed, muted: spec.muted, bus: createEventBus<GameEvents>() });
  world.phase = spec.phase;
  Object.assign(world.kiro, spec.kiro);
  const items = world.pool.items;
  for (let i = 0; i < items.length && i < spec.items.length; i++) {
    Object.assign(items[i] as object, spec.items[i]);
  }
  world.score = spec.score;
  world.activatedCount = spec.activatedCount;
  world.distanceSinceSpawn = spec.distanceSinceSpawn;
  world.stepIndex = spec.stepIndex;
  world.flapPending = spec.flapPending;
  for (let i = 0; i < spec.draws; i++) world.rng.next();
  return world;
}

// Feature: flappy-rendu-2-5d-m2, Property 17: Lecture seule de l'Etat_Moteur
describe("Property 17: Lecture seule de l'Etat_Moteur", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * **Validates: Requirements 8.1, 10.7**
   */
  it("l'Etat_Moteur est identique avant/apr�s chaque image, avec ou sans Overlay_Debug, y compris gel�", () => {
    const fakeElement = {
      style: { cssText: '' },
      textContent: '',
      setAttribute: (): void => undefined,
      appendChild: (): void => undefined,
      remove: (): void => undefined,
    };
    vi.stubGlobal('document', {
      body: fakeElement,
      createElement: () => ({ ...fakeElement, style: { cssText: '' } }),
    });

    fc.assert(
      fc.property(
        worldSpecArb,
        alphasArb,
        nowStepsArb,
        fc.boolean(),
        fc.boolean(),
        (spec, alphas, steps, debug, freeze) => {
          const world = buildWorld(spec);
          if (freeze) deepFreezeWorld(world);
          const rs = createRenderScene({ world });
          const overlay = createDebugOverlay(debug, rs.scene);
          try {
            let now = 0;
            const n = Math.min(alphas.length, steps.length);
            for (let i = 0; i < n; i++) {
              now += steps[i] as number;
              const before = worldSnapshot(world);
              rs.update(alphas[i] as number, now);
              overlay?.update(world, now * 1000, {
                game: { calls: 0, triangles: 0 },
                overlay: { calls: 0, triangles: 0 },
              });
              expect(worldSnapshot(world)).toStrictEqual(before);
            }
          } finally {
            overlay?.dispose();
            rs.dispose();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

interface SceneStats {
  children: number;
  geometries: number;
  materials: number;
  intensities: number[];
}

function sceneStats(scene: Object3D): SceneStats {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const intensities: number[] = [];
  scene.traverse((obj) => {
    const mesh = obj as Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) {
      const m = mesh.material;
      if (Array.isArray(m)) for (const x of m) materials.add(x);
      else materials.add(m);
    }
    if ((obj as Light).isLight) intensities.push((obj as Light).intensity);
  });
  return {
    children: scene.children.length,
    geometries: geometries.size,
    materials: materials.size,
    intensities,
  };
}

const sizeArb = fc.integer({ min: 1, max: 4096 });

// Feature: flappy-rendu-2-5d-m2, Property 18: Stabilit� des objets de la sc�ne
describe('Property 18: Stabilit� des objets de la sc�ne', () => {
  /**
   * **Validates: Requirements 7.6, 9.1, 9.2, 14.7**
   */
  it('enfants, g�om�tries, mat�riaux et intensit�s des lumi�res sont identiques avant/apr�s une suite d\'images et de resize', () => {
    fc.assert(
      fc.property(
        worldSpecArb,
        alphasArb,
        nowStepsArb,
        fc.array(fc.tuple(sizeArb, sizeArb), { minLength: 1, maxLength: 6 }),
        (spec, alphas, steps, sizes) => {
          const world = buildWorld(spec);
          const rs = createRenderScene({ world });
          try {
            const before = sceneStats(rs.scene);
            let now = 0;
            const n = Math.min(alphas.length, steps.length);
            for (let i = 0; i < n; i++) {
              now += steps[i] as number;
              const size = sizes[i % sizes.length] as [number, number];
              if (i % 2 === 0) rs.resize(size[0], size[1]);
              rs.update(alphas[i] as number, now);
            }
            for (const [w, h] of sizes) rs.resize(w, h);
            rs.update(0.5, now + 1);
            expect(sceneStats(rs.scene)).toStrictEqual(before);
          } finally {
            rs.dispose();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
