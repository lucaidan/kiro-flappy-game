import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseUrlParams, serializeUrlParams } from '../../src/core/url-params';

/**
 * Feature: flappy-logic-engine-m1, Property 24: Aller-retour des paramètres d'URL
 * **Validates: Requirements 9.11**
 */
describe("Property 24: Aller-retour des paramètres d'URL", () => {
  it('parse(serialize(p)) equals p for any valid params', () => {
    fc.assert(
      fc.property(
        fc.record({
          debug: fc.boolean(),
          bot: fc.boolean(),
          mute: fc.boolean(),
          seed: fc.integer({ min: 0, max: 4294967295 }),
        }),
        fc.integer({ min: 0, max: 4294967295 }),
        (params, fallback) => {
          const result = parseUrlParams(serializeUrlParams(params), () => fallback);
          expect(result).toEqual(params);
        },
      ),
      { numRuns: 200 },
    );
  });
});
