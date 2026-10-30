import { describe, it, expect } from 'vitest';
import { createEventBus } from '../../src/core/events';

interface TestEvents {
  ping: { value: number };
  pong: { value: number };
}

describe('EventBus (unit)', () => {
  it('emit sans abonné ne lève pas et n\'appelle pas onError (12.3)', () => {
    const errors: unknown[] = [];
    const bus = createEventBus<TestEvents>((e) => errors.push(e));
    expect(() => bus.emit('ping', { value: 1 })).not.toThrow();
    expect(errors).toEqual([]);
  });

  it('emit sans abonné pour cet événement, malgré des abonnés à un autre (12.3)', () => {
    const bus = createEventBus<TestEvents>();
    const received: number[] = [];
    bus.on('pong', (p) => received.push(p.value));
    expect(() => bus.emit('ping', { value: 1 })).not.toThrow();
    expect(received).toEqual([]);
  });

  it('un abonné désabonné en cours de livraison avant son tour n\'est pas appelé (12.5)', () => {
    const bus = createEventBus<TestEvents>();
    const calls: string[] = [];
    let unsubB: () => void = () => {};
    bus.on('ping', () => {
      calls.push('A');
      unsubB();
    });
    unsubB = bus.on('ping', () => calls.push('B'));
    bus.on('ping', () => calls.push('C'));

    bus.emit('ping', { value: 1 });
    expect(calls).toEqual(['A', 'C']);

    calls.length = 0;
    bus.emit('ping', { value: 2 });
    expect(calls).toEqual(['A', 'C']);
  });

  it('un abonné qui se désabonne lui-même reste appelé une fois puis plus jamais (12.5)', () => {
    const bus = createEventBus<TestEvents>();
    let count = 0;
    const unsub = bus.on('ping', () => {
      count++;
      unsub();
    });
    bus.emit('ping', { value: 1 });
    bus.emit('ping', { value: 2 });
    expect(count).toBe(1);
  });

  it('un abonné désabonné après avoir été appelé ne gêne pas les suivants (12.5)', () => {
    const bus = createEventBus<TestEvents>();
    const calls: string[] = [];
    let unsubA: () => void = () => {};
    unsubA = bus.on('ping', () => {
      calls.push('A');
      unsubA();
    });
    bus.on('ping', () => calls.push('B'));
    bus.emit('ping', { value: 1 });
    expect(calls).toEqual(['A', 'B']);
  });
});
