import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createActionQueue, createInput } from '../../src/input/input';
import type { InputTarget, PlayerAction } from '../../src/input/input';
import { GAME_CONFIG } from '../../src/config/game.config';
import type { ActionBuffer } from '../../src/game/state';

const MAX = GAME_CONFIG.INPUT_QUEUE_MAX;
const actionArb = fc.constantFrom<PlayerAction>('flap', 'pause', 'mute');

/** Tampon enregistrant l'ordre dans lequel chaque action est posée (première occurrence). */
function recordingBuffer(): { buf: ActionBuffer; order: PlayerAction[] } {
  const order: PlayerAction[] = [];
  const state = { flap: false, pause: false, mute: false };
  const buf = {} as ActionBuffer;
  for (const key of ['flap', 'pause', 'mute'] as const) {
    Object.defineProperty(buf, key, {
      get: () => state[key],
      set: (v: boolean) => {
        if (v && !state[key]) order.push(key);
        state[key] = v;
      },
      enumerable: true,
    });
  }
  return { buf, order };
}

function firstOccurrences(actions: readonly PlayerAction[]): PlayerAction[] {
  return [...new Set(actions)];
}

function fakeTarget(): InputTarget & { fire(type: string, ev: object): void } {
  const listeners = new Map<string, Set<(e: never) => void>>();
  return {
    addEventListener(type, l) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(l);
    },
    removeEventListener(type, l) {
      listeners.get(type)?.delete(l);
    },
    fire(type, ev) {
      for (const l of listeners.get(type) ?? []) (l as (e: object) => void)(ev);
    },
  };
}

const KEY_FOR: Record<PlayerAction, string> = { flap: 'Space', pause: 'KeyP', mute: 'KeyM' };

describe('Property 22: File d\'actions bornée et ordonnée', () => {
  /**
   * **Validates: Requirements 8.6, 8.7**
   */
  it('la file est bornée à 32 : les nouvelles actions sont ignorées sans modifier celles en file', () => {
    fc.assert(
      fc.property(fc.array(actionArb, { maxLength: 100 }), (actions) => {
        const q = createActionQueue(MAX);
        actions.forEach((a, i) => {
          expect(q.push(a)).toBe(i < MAX);
          expect(q.size()).toBe(Math.min(i + 1, MAX));
        });
        // Le contenu restitué correspond exactement aux 32 premières actions.
        const { buf, order } = recordingBuffer();
        q.drain(buf);
        expect(order).toEqual(firstOccurrences(actions.slice(0, MAX)));
      }),
      { numRuns: 200 },
    );
  });

  /** **Validates: Requirements 8.6** */
  it('drain restitue les actions dans l\'ordre d\'arrivée et vide la file', () => {
    fc.assert(
      fc.property(fc.array(actionArb, { maxLength: MAX }), (actions) => {
        const q = createActionQueue(MAX);
        for (const a of actions) q.push(a);
        const { buf, order } = recordingBuffer();
        q.drain(buf);
        expect(order).toEqual(firstOccurrences(actions));
        expect(q.size()).toBe(0);
        // Un second drain ne produit rien.
        const second = recordingBuffer();
        q.drain(second.buf);
        expect(second.order).toEqual([]);
      }),
      { numRuns: 200 },
    );
  });

  /** **Validates: Requirements 8.6, 8.7** */
  it('la file est réutilisable après drain (circularité), toujours bornée et ordonnée', () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(actionArb, { maxLength: 50 }), { minLength: 1, maxLength: 6 }),
        (batches) => {
          const q = createActionQueue(MAX);
          for (const batch of batches) {
            for (const a of batch) q.push(a);
            const { buf, order } = recordingBuffer();
            q.drain(buf);
            expect(order).toEqual(firstOccurrences(batch.slice(0, MAX)));
            expect(q.size()).toBe(0);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  /** **Validates: Requirements 8.6, 8.7** */
  it('via createInput : ordre préservé, borne de 32 et drain vide la file', () => {
    fc.assert(
      fc.property(fc.array(actionArb, { maxLength: 80 }), (actions) => {
        const target = fakeTarget();
        const input = createInput(target);
        for (const a of actions) target.fire('keydown', { code: KEY_FOR[a], repeat: false });
        const { buf, order } = recordingBuffer();
        input.drain(buf);
        expect(order).toEqual(firstOccurrences(actions.slice(0, MAX)));
        const second = recordingBuffer();
        input.drain(second.buf);
        expect(second.order).toEqual([]);
        input.dispose();
      }),
      { numRuns: 200 },
    );
  });
});
