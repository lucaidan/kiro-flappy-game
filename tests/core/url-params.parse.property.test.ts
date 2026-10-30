import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseUrlParams } from '../../src/core/url-params';

/**
 * Feature: flappy-logic-engine-m1, Property 23: Parseur d'URL
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.8, 9.9, 9.10**
 */

const KEYS = ['debug', 'bot', 'mute', 'seed', 'unknown', 'Debug', 'seed2', ''];

const valueArb = fc.oneof(
  fc.constantFrom('1', '0', '', 'true', '01', ' 1', '1 ', '4294967295', '4294967296', '0000000001', '99999999999'),
  fc.integer({ min: 0, max: 5_000_000_000 }).map(String),
  fc.stringMatching(/^[0-9]{1,12}$/),
  fc.string({ maxLength: 8 }).filter((s) => !s.includes('&')),
);

/** A pair; `null` value means the key appears without `=`. */
const pairArb = fc.tuple(fc.constantFrom(...KEYS), fc.option(valueArb, { nil: null }));

const FALLBACK = 123456;

function expected(pairs: Array<[string, string | null]>) {
  const first = (k: string): string | undefined => {
    const p = pairs.find(([key]) => key === k);
    return p === undefined ? undefined : (p[1] ?? '');
  };
  const seedRaw = first('seed');
  const seedOk =
    seedRaw !== undefined && /^[0-9]{1,10}$/.test(seedRaw) && Number(seedRaw) <= 4294967295;
  return {
    debug: first('debug') === '1',
    bot: first('bot') === '1',
    mute: first('mute') === '1',
    seed: seedOk ? Number(seedRaw) : FALLBACK,
  };
}

describe('Property 23: Parseur d\'URL', () => {
  it('matches the reference model for any query string', () => {
    fc.assert(
      fc.property(fc.array(pairArb, { maxLength: 10 }), fc.boolean(), (pairs, withQ) => {
        const typed = pairs as Array<[string, string | null]>;
        const body = typed.map(([k, v]) => (v === null ? k : `${k}=${v}`)).join('&');
        const query = (withQ ? '?' : '') + body;
        const result = parseUrlParams(query, () => FALLBACK);
        expect(result).toEqual(expected(typed));
        // determinism
        expect(parseUrlParams(query, () => FALLBACK)).toEqual(result);
      }),
      { numRuns: 200 },
    );
  });

  it('invalid seed leaves other fields untouched and uses the injected source', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.constantFrom('abc', '4294967296', '-1', '', '12345678901'),
        (debug, bot, mute, badSeed) => {
          const good = `debug=${debug ? 1 : 0}&bot=${bot ? 1 : 0}&mute=${mute ? 1 : 0}`;
          const withBad = parseUrlParams(`?seed=${badSeed}&${good}`, () => 7);
          const without = parseUrlParams(`?${good}`, () => 7);
          expect(withBad).toEqual(without);
          expect(withBad.seed).toBe(7);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('handles empty query and boundary seeds', () => {
    expect(parseUrlParams('', () => 5)).toEqual({ debug: false, bot: false, mute: false, seed: 5 });
    expect(parseUrlParams('?seed=4294967295', () => 5).seed).toBe(4294967295);
    expect(parseUrlParams('?seed=4294967296', () => 5).seed).toBe(5);
    expect(parseUrlParams('?debug=1&debug=0', () => 5).debug).toBe(true);
    expect(parseUrlParams('?debug=0&debug=1', () => 5).debug).toBe(false);
  });
});
