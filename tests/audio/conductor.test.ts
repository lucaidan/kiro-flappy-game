import { describe, expect, it } from 'vitest';
import { AUDIO_CONFIG } from '../../src/config/audio.config';
import { createBeatQueue } from '../../src/audio/beat-queue';
import { createConductor, type ToneApi, type TransportLike } from '../../src/audio/conductor';

function makeFake(opts: { failStart?: boolean } = {}) {
  const calls: string[] = [];
  let repeatCb: ((time: number) => void) | null = null;
  let repeatInterval: string | null = null;
  let nowValue = 0;
  const transport: TransportLike = {
    scheduleRepeat(cb, interval) {
      calls.push('scheduleRepeat');
      repeatCb = cb;
      repeatInterval = interval;
      return 1;
    },
    start() {
      calls.push('transport.start');
    },
    pause() {
      calls.push('transport.pause');
    },
    stop() {
      calls.push('transport.stop');
    },
    cancel() {
      calls.push('transport.cancel');
    },
    bpm: { value: 0 },
  };
  const tone: ToneApi = {
    async start() {
      calls.push('tone.start');
      if (opts.failStart) throw new Error('blocked');
    },
    now: () => nowValue,
    transport: () => transport,
    setOutputMuted(m) {
      calls.push(`mute:${m}`);
    },
  };
  return {
    tone,
    calls,
    transport,
    fire: (t: number) => repeatCb?.(t),
    interval: () => repeatInterval,
    setNow: (n: number) => {
      nowValue = n;
    },
  };
}

describe('createConductor (ToneApi factice)', () => {
  it('appelle scheduleRepeat avec 4n et règle le BPM', async () => {
    const f = makeFake();
    const c = createConductor(f.tone, createBeatQueue(AUDIO_CONFIG.QUEUE_SIZE));
    await c.unlock();
    c.restart();
    expect(f.interval()).toBe('4n');
    expect(f.transport.bpm.value).toBe(AUDIO_CONFIG.BPM);
    expect(c.isRunning()).toBe(true);
  });

  it('appelle unlock (Tone.start) avant le démarrage du Transport, même si restart précède unlock', async () => {
    const f = makeFake();
    const c = createConductor(f.tone, createBeatQueue(AUDIO_CONFIG.QUEUE_SIZE));
    c.restart();
    expect(f.calls).toEqual([]);
    expect(c.isRunning()).toBe(false);
    await c.unlock();
    expect(f.calls.indexOf('tone.start')).toBeLessThan(f.calls.indexOf('transport.start'));
    expect(c.isRunning()).toBe(true);
  });

  it('le callback pousse des événements dans la file avec pattern = beatIndex % 4', async () => {
    const f = makeFake();
    const q = createBeatQueue(AUDIO_CONFIG.QUEUE_SIZE);
    const c = createConductor(f.tone, q);
    await c.unlock();
    c.restart();
    for (let i = 0; i < 5; i++) f.fire(i * 0.5);
    expect(q.size).toBe(5);
    expect(c.beatIndex).toBe(5);
    const out: { beatIndex: number; pattern: number }[] = [];
    q.drainDue(100, out as never);
    expect(out.map((e) => e.pattern)).toEqual([0, 1, 2, 3, 0]);
  });

  it('pause puis reprise : purge les événements périmés puis relance', async () => {
    const f = makeFake();
    const q = createBeatQueue(AUDIO_CONFIG.QUEUE_SIZE);
    const c = createConductor(f.tone, q);
    await c.unlock();
    c.restart();
    f.fire(1);
    f.fire(100);
    c.pause();
    expect(f.calls).toContain('transport.pause');
    expect(c.isRunning()).toBe(false);
    f.setNow(100);
    f.calls.length = 0;
    c.resume();
    expect(f.calls).toEqual(['transport.start']);
    expect(q.size).toBe(1); // l'événement à t=1 est périmé
    expect(c.isRunning()).toBe(true);
  });

  it('restart repart de 0 et vide la file', async () => {
    const f = makeFake();
    const q = createBeatQueue(AUDIO_CONFIG.QUEUE_SIZE);
    const c = createConductor(f.tone, q);
    await c.unlock();
    c.restart();
    f.fire(0);
    f.fire(0.5);
    expect(c.beatIndex).toBe(2);
    f.calls.length = 0;
    c.restart();
    expect(c.beatIndex).toBe(0);
    expect(q.size).toBe(0);
    expect(f.calls).toContain('transport.cancel');
    expect(f.calls[f.calls.length - 1]).toBe('transport.start');
  });

  it("setMuted coupe la sortie sans arrêter le Transport", async () => {
    const f = makeFake();
    const c = createConductor(f.tone, createBeatQueue(AUDIO_CONFIG.QUEUE_SIZE));
    await c.unlock();
    c.restart();
    f.calls.length = 0;
    c.setMuted(true);
    expect(f.calls).toEqual(['mute:true']);
    expect(c.isRunning()).toBe(true);
  });

  it('onBeat notifie après le push, survit au redémarrage, se désabonne et est vidé à dispose', async () => {
    const f = makeFake();
    const q = createBeatQueue(AUDIO_CONFIG.QUEUE_SIZE);
    const c = createConductor(f.tone, q);
    await c.unlock();
    c.restart();
    const seen: { beatIndex: number; size: number }[] = [];
    const off = c.onBeat((e) => seen.push({ beatIndex: e.beatIndex, size: q.size }));
    f.fire(0);
    f.fire(0.5);
    expect(seen).toEqual([
      { beatIndex: 0, size: 1 },
      { beatIndex: 1, size: 2 },
    ]);
    c.restart();
    f.fire(0);
    expect(seen.length).toBe(3);
    expect(seen[2]?.beatIndex).toBe(0);
    off();
    f.fire(0.5);
    expect(seen.length).toBe(3);
    let n = 0;
    c.onBeat(() => n++);
    c.dispose();
    f.fire(1);
    expect(n).toBe(0);
  });

  it('échec de unlock : erreur relancée, indisponible, aucun démarrage', async () => {
    const f = makeFake({ failStart: true });
    const c = createConductor(f.tone, createBeatQueue(AUDIO_CONFIG.QUEUE_SIZE));
    c.restart();
    await expect(c.unlock()).rejects.toThrow('blocked');
    expect(c.isRunning()).toBe(false);
    c.restart();
    c.resume();
    expect(f.calls).not.toContain('transport.start');
    expect(c.isRunning()).toBe(false);
  });
});
