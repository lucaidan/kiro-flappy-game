import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../../src/config/game.config';
import { RENDER_CONFIG } from '../../src/config/render.config';
import {
  computeFollowOffset,
  computePose,
  computeProjection,
  createPose,
  createProjection,
} from '../../src/render/camera';

const { FLOOR, CEILING } = GAME_CONFIG.WORLD;

describe('camera follow (property)', () => {
  // Feature: flappy-rendu-2-5d-m2, Property 4: Borne du Suivi_Vertical
  it('Property 4: |computeFollowOffset(kiroY)| <= FOLLOW_Y*(CEILING-FLOOR)/2 pour kiroY dans la Zone_Jeu', () => {
    // **Validates: Requirements 1.4, 1.6**
    const bound = (RENDER_CONFIG.FOLLOW_Y * (CEILING - FLOOR)) / 2;
    fc.assert(
      fc.property(fc.double({ min: FLOOR, max: CEILING, noNaN: true }), (kiroY) => {
        return Math.abs(computeFollowOffset(kiroY)) <= bound + 1e-12;
      }),
      { numRuns: 200 },
    );
  });

  // Feature: flappy-rendu-2-5d-m2, Property 5: Cadrage sans état
  it('Property 5: computeProjection/computePose sont sans état (appels intercalés sans effet)', () => {
    // **Validates: Requirements 1.7**
    const aspectArb = fc.oneof(
      fc.double({ min: 0.1, max: 5, noNaN: true }),
      fc.constantFrom(0, -1, Number.NaN, Number.POSITIVE_INFINITY),
    );
    const yArb = fc.double({ min: FLOOR, max: CEILING, noNaN: true });
    fc.assert(
      fc.property(aspectArb, yArb, aspectArb, yArb, (a1, y1, a2, y2) => {
        const proj1 = createProjection();
        const pose1 = createPose();
        computeProjection(a1, proj1);
        computePose(proj1, y1, pose1);
        const refProj = { ...proj1 };
        const refPose = { ...pose1 };

        // Appels intercalés avec d'autres entrées
        const otherProj = createProjection();
        const otherPose = createPose();
        computeProjection(a2, otherProj);
        computePose(otherProj, y2, otherPose);

        const proj3 = createProjection();
        const pose3 = createPose();
        computeProjection(a1, proj3);
        computePose(proj3, y1, pose3);
        // Rejouer sur des sorties réutilisées (déjà remplies par d'autres entrées)
        computeProjection(a1, otherProj);
        computePose(otherProj, y1, otherPose);

        expect(proj3).toEqual(refProj);
        expect(pose3).toEqual(refPose);
        expect(otherProj).toEqual(refProj);
        expect(otherPose).toEqual(refPose);
      }),
      { numRuns: 200 },
    );
  });});
