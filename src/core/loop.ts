export interface Loop {
  /** Avance le temps réel de deltaMs ; retourne alpha dans [0, 1[. */
  advance(deltaMs: number): number;
  readonly stepMs: number;
}

export interface LoopOptions {
  fixedDtSeconds: number;
  maxFrameMs: number;
}

export interface LoopClock {
  now(): number;
  schedule(cb: () => void): void;
}

const DEFAULT_MAX_FRAME_MS = 250;

export function createLoop(options: LoopOptions, update: (stepIndex: number) => void): Loop {
  const { fixedDtSeconds, maxFrameMs } = options;
  if (!Number.isFinite(fixedDtSeconds) || fixedDtSeconds <= 0) {
    throw new Error('Pas_Fixe invalide');
  }
  const stepMs = fixedDtSeconds * 1000;
  if (!Number.isFinite(stepMs) || stepMs <= 0) {
    throw new Error('Pas_Fixe invalide');
  }
  const cap =
    Number.isFinite(maxFrameMs) && maxFrameMs >= 0
      ? Math.min(maxFrameMs, DEFAULT_MAX_FRAME_MS)
      : DEFAULT_MAX_FRAME_MS;

  let rest = 0;
  let stepIndex = 0;

  return {
    stepMs,
    advance(deltaMs: number): number {
      const dt = Number.isFinite(deltaMs) && deltaMs > 0 ? Math.min(deltaMs, cap) : 0;
      if (dt === 0) return rest / stepMs;

      const total = rest + dt;
      const count = Math.floor(total / stepMs);
      for (let i = 0; i < count; i++) {
        update(stepIndex++);
      }
      let next = total - count * stepMs;
      // Garde contre la dérive flottante : reste dans [0, stepMs[.
      if (next < 0) next = 0;
      if (next >= stepMs) next = 0;
      rest = next;
      return rest / stepMs;
    },
  };
}

/** Démarre la boucle ; `onFrame(alpha)` (optionnel) est appelé après chaque `advance`. */
export function startLoop(loop: Loop, clock: LoopClock, onFrame?: (alpha: number) => void): void {
  let last = clock.now();
  const tick = (): void => {
    const now = clock.now();
    const alpha = loop.advance(now - last);
    last = now;
    if (onFrame !== undefined) onFrame(alpha);
    clock.schedule(tick);
  };
  clock.schedule(tick);
}
