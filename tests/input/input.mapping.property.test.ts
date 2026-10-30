import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { mapRawInput } from '../../src/input/input';
import type { PlayerAction, RawInput } from '../../src/input/input';

const KEY_MAP: Record<string, PlayerAction> = {
  Space: 'flap',
  ArrowUp: 'flap',
  KeyP: 'pause',
  KeyM: 'mute',
};

const codeArb = fc.oneof(
  fc.constantFrom('Space', 'ArrowUp', 'KeyP', 'KeyM', 'KeyA', 'Enter', 'ArrowDown'),
  fc.string(),
);

const rawArb: fc.Arbitrary<RawInput> = fc.record(
  {
    kind: fc.constantFrom('keydown', 'keyup', 'pointerdown'),
    code: codeArb,
    button: fc.integer({ min: 0, max: 4 }),
    isPrimary: fc.boolean(),
    repeat: fc.boolean(),
  },
  { requiredKeys: ['kind'] },
) as fc.Arbitrary<RawInput>;

function expected(raw: RawInput): PlayerAction | undefined {
  if (raw.kind === 'keydown') {
    if (raw.repeat === true) return undefined;
    return raw.code !== undefined && Object.hasOwn(KEY_MAP, raw.code) ? KEY_MAP[raw.code] : undefined;
  }
  if (raw.kind === 'pointerdown') {
    return raw.isPrimary === true && raw.button === 0 ? 'flap' : undefined;
  }
  return undefined;
}

describe('Property 21: Correspondance des entrées brutes', () => {
  /** **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.8, 8.9** */
  it('mapRawInput suit la table de correspondance et est déterministe', () => {
    fc.assert(
      fc.property(rawArb, (raw) => {
        const first = mapRawInput(raw);
        expect(first).toBe(expected(raw));
        expect(mapRawInput({ ...raw })).toBe(first);
      }),
      { numRuns: 200 },
    );
  });

  it('exemples : touches assignées, bouton secondaire, répétition', () => {
    expect(mapRawInput({ kind: 'keydown', code: 'Space', repeat: false })).toBe('flap');
    expect(mapRawInput({ kind: 'keydown', code: 'ArrowUp' })).toBe('flap');
    expect(mapRawInput({ kind: 'keydown', code: 'KeyP' })).toBe('pause');
    expect(mapRawInput({ kind: 'keydown', code: 'KeyM' })).toBe('mute');
    expect(mapRawInput({ kind: 'keydown', code: 'Space', repeat: true })).toBeUndefined();
    expect(mapRawInput({ kind: 'pointerdown', button: 0, isPrimary: true })).toBe('flap');
    expect(mapRawInput({ kind: 'pointerdown', button: 2, isPrimary: true })).toBeUndefined();
    expect(mapRawInput({ kind: 'pointerdown', button: 0, isPrimary: false })).toBeUndefined();
  });
});
