import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createEventBus } from '../../src/core/events';

interface TestEvents {
  ping: { value: number; tag: string };
}

/**
 * Feature: flappy-logic-engine-m1, Property 28: Livraison du bus d'événements
 *
 * **Validates: Requirements 12.2, 12.4, 12.6**
 */
describe('Property 28: Livraison du bus d\'événements', () => {
  const payloadArb = fc.record({ value: fc.integer(), tag: fc.string() });
  // Pour chaque abonné : se désabonne-t-il ? lève-t-il une exception ?
  const subsArb = fc.array(
    fc.record({ unsub: fc.boolean(), throws: fc.boolean() }),
    { maxLength: 12 },
  );

  it('livre dans l\'ordre, charge inchangée, isole les exceptions et respecte le désabonnement', () => {
    fc.assert(
      fc.property(subsArb, payloadArb, (specs, payload) => {
        const errors: unknown[] = [];
        const bus = createEventBus<TestEvents>((e) => errors.push(e));
        const calls: number[] = [];
        const received: unknown[] = [];
        const thrown: unknown[] = [];

        const unsubs = specs.map((spec, i) =>
          bus.on('ping', (p) => {
            calls.push(i);
            received.push(p);
            if (spec.throws) {
              const err = new Error(`boom-${i}`);
              thrown.push(err);
              throw err;
            }
          }),
        );
        specs.forEach((spec, i) => {
          if (spec.unsub) unsubs[i]?.();
        });

        expect(() => bus.emit('ping', payload)).not.toThrow();

        const expected = specs.flatMap((s, i) => (s.unsub ? [] : [i]));
        expect(calls).toEqual(expected);
        for (const r of received) expect(r).toBe(payload);
        expect(errors).toEqual(thrown);

        // Les désabonnés ne reçoivent plus rien lors d'un second emit.
        calls.length = 0;
        bus.emit('ping', payload);
        expect(calls).toEqual(expected);
      }),
      { numRuns: 100 },
    );
  });

  it('fonctionne sans onError même si un abonné lève', () => {
    fc.assert(
      fc.property(payloadArb, (payload) => {
        const bus = createEventBus<TestEvents>();
        let got = 0;
        bus.on('ping', () => {
          throw new Error('x');
        });
        bus.on('ping', () => {
          got++;
        });
        expect(() => bus.emit('ping', payload)).not.toThrow();
        expect(got).toBe(1);
      }),
      { numRuns: 100 },
    );
  });
});
