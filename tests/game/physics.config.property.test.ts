import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateConfig, type PhysicsConfig, type KiroState } from '../../src/game/physics';

const KEYS: (keyof PhysicsConfig)[] = ['GRAVITY', 'FLAP_VELOCITY', 'MAX_FALL_SPEED', 'FIXED_DT'];
const valid: PhysicsConfig = { GRAVITY: -30, FLAP_VELOCITY: 9, MAX_FALL_SPEED: 14, FIXED_DT: 1 / 60 };

const nonFinite = fc.constantFrom(NaN, Infinity, -Infinity);

describe('Property 8: Rejet d\'une configuration physique invalide', () => {
  /** **Validates: Requirements 3.8** */
  it('rejette NaN/infini en nommant le paramètre fautif, état de Kiro inchangé', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...KEYS),
        nonFinite,
        fc.record({
          x: fc.double({ noNaN: true }),
          y: fc.double({ noNaN: true }),
          vy: fc.double({ noNaN: true }),
        }),
        (key, bad, k) => {
          const kiro: KiroState = { ...k, prevY: k.y, prevVy: k.vy };
          const before = { ...kiro };
          const config = { ...valid, [key]: bad };
          expect(() => validateConfig(config)).toThrow(new RegExp(key));
          expect(kiro).toEqual(before);
        },
      ),
      { numRuns: 100 },
    );
  });

  /** **Validates: Requirements 3.8** */
  it('rejette un pas fixe ≤ 0 en nommant FIXED_DT', () => {
    fc.assert(
      fc.property(
        fc.double({ max: 0, noNaN: true, noDefaultInfinity: true }),
        (dt) => {
          expect(() => validateConfig({ ...valid, FIXED_DT: dt })).toThrow(/FIXED_DT/);
        },
      ),
      { numRuns: 100 },
    );
  });
});
