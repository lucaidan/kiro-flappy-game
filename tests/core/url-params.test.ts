import { describe, it, expect } from 'vitest';
import { parseUrlParams } from '../../src/core/url-params';

const FALLBACK = 12345;
const source = (): number => FALLBACK;

describe('parseUrlParams', () => {
  it('uses defaults when params are absent', () => {
    expect(parseUrlParams('?foo=bar', source)).toEqual({
      debug: false,
      bot: false,
      mute: false,
      seed: FALLBACK,
    });
  });

  it('handles an empty string with defaults', () => {
    expect(parseUrlParams('', source)).toEqual({
      debug: false,
      bot: false,
      mute: false,
      seed: FALLBACK,
    });
  });

  it('handles a lone "?" with defaults', () => {
    expect(parseUrlParams('?', source)).toEqual({
      debug: false,
      bot: false,
      mute: false,
      seed: FALLBACK,
    });
  });

  it('parses with a leading "?"', () => {
    expect(parseUrlParams('?debug=1&bot=1&mute=1&seed=42', source)).toEqual({
      debug: true,
      bot: true,
      mute: true,
      seed: 42,
    });
  });

  it('parses without a leading "?"', () => {
    expect(parseUrlParams('debug=1&seed=7', source)).toEqual({
      debug: true,
      bot: false,
      mute: false,
      seed: 7,
    });
  });

  it('does not call seedSource result when a valid seed is given', () => {
    expect(parseUrlParams('?seed=0', source).seed).toBe(0);
  });
});
