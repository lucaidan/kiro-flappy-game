import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { GAME_CONFIG } from '../../src/config/game.config';
import { applyFlap, integrateKiro, type KiroState } from '../../src/game/physics';

const { GRAVITY, FLAP_VELOCITY, MAX_FALL_SPEED, FIXED_DT } = GAME_CONFIG;

const kiroArb: fc.Arbitrary<KiroState> = fc.record({
  x: fc.double({ min: -10, max: 10, noNaN: true }),
  y: fc.double({ min: -100, max: 100, noNaN: true }),
  vy: fc.double({ min: -50, max: 50, noNaN: true }),
  prevY: fc.double({ min: -100, max: 100, noNaN: true }),
  prevVy: fc.double({ min: -50, max: 50, noNaN: true }),
});

/** Chaque pas : nombre d'actions de battement reçues (0 = aucun). */
const stepsArb = fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 1, maxLength: 60 });

/** Modèle de référence : battement, gravité, limite de chute, intégration. */
function refStep(s: KiroState, flapped: boolean): KiroState {
  let vy = flapped ? FLAP_VELOCITY : s.vy;
  vy = vy + GRAVITY * FIXED_DT;
  if (vy < -MAX_FALL_SPEED) vy = -MAX_FALL_SPEED;
  return { x: s.x, y: s.y + vy * FIXED_DT, vy, prevY: s.y, prevVy: flapped ? FLAP_VELOCITY : s.vy };
}

describe('Property 6: Physique de Kiro conforme au modèle de référence', () => {
  /**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6**
   */
  it('suit le modèle de référence, borne la chute, accepte au plus un battement par pas et conserve prevY/prevVy', () => {
    fc.assert(
      fc.property(kiroArb, stepsArb, (initial, steps) => {
        const kiro: KiroState = { ...initial };
        let ref: KiroState = { ...initial };
        for (const flaps of steps) {
          const beforeY = kiro.y;
          for (let i = 0; i < flaps; i++) applyFlap(kiro);
          // prevVy est la vitesse au début de l'intégration (battement inclus).
          const beforeVy = kiro.vy;
          integrateKiro(kiro);
          ref = refStep(ref, flaps > 0);

          expect(kiro.vy).toBeCloseTo(ref.vy, 9);
          expect(kiro.y).toBeCloseTo(ref.y, 9);
          expect(kiro.vy).toBeGreaterThanOrEqual(-MAX_FALL_SPEED);
          expect(kiro.prevY).toBe(beforeY);
          expect(kiro.prevVy).toBe(beforeVy);
          expect(beforeVy).toBe(ref.prevVy);
        }
      }),
      { numRuns: 100 },
    );
  });
});
