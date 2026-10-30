import fc from 'fast-check';
import { Fog } from 'three';
import { describe, it } from 'vitest';
import { GAME_CONFIG } from '../../src/config/game.config';
import { RENDER_CONFIG } from '../../src/config/render.config';
import { computePose, createPose, createProjection, computeProjection } from '../../src/render/camera';
import { createFog, updateFog } from '../../src/render/environment/fog';

const { LEFT, RIGHT, FLOOR, CEILING } = GAME_CONFIG.WORLD;
const HALF_DEPTH = Math.max(RENDER_CONFIG.STELE.DEPTH, RENDER_CONFIG.BOUNDARY.DEPTH) / 2;
const T = RENDER_CONFIG.BOUNDARY.THICKNESS;

describe('fog (property)', () => {
  // Feature: flappy-rendu-2-5d-m2, Property 6: Brouillard au-delà du Plan_Jeu
  it('Property 6: fog.near > distance, et le Plan_Jeu (avec son épaisseur) reste plus proche que fog.near', () => {
    // **Validates: Requirements 7.4**
    const aspect = fc.double({ min: 1e-3, max: 1e3, noNaN: true });
    const kiroY = fc.double({ min: FLOOR, max: CEILING, noNaN: true });
    fc.assert(
      fc.property(aspect, kiroY, (a, y) => {
        const projection = createProjection();
        computeProjection(a, projection);
        const pose = createPose();
        computePose(projection, y, pose);
        const fog: Fog = createFog();
        updateFog(fog, projection.distance);

        if (!(fog.near > projection.distance && fog.near < fog.far)) return false;

        for (const x of [LEFT, RIGHT]) {
          for (const py of [FLOOR - T, CEILING + T]) {
            for (const z of [-HALF_DEPTH, HALF_DEPTH]) {
              // Le brouillard de three.js dépend de la profondeur de vue (composante le long de l'axe optique).
              const d =
                ((x - pose.px) * (pose.tx - pose.px) + (py - pose.py) * (pose.ty - pose.py) + (z - pose.pz) * (pose.tz - pose.pz)) /
                projection.distance;
              if (!(d < fog.near)) return false;
            }
          }
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });
});

