import { GAME_CONFIG } from '../config/game.config';
import type { ActionBuffer } from '../game/state';

export type PlayerAction = 'flap' | 'pause' | 'mute';

export interface RawInput {
  kind: 'keydown' | 'keyup' | 'pointerdown';
  code?: string;
  button?: number;
  isPrimary?: boolean;
  repeat?: boolean;
}

/** Correspondance pure entrée brute -> action (8.1 à 8.5, 8.8, 8.9). */
export function mapRawInput(raw: RawInput): PlayerAction | undefined {
  if (raw.kind === 'keydown') {
    if (raw.repeat === true) return undefined;
    switch (raw.code) {
      case 'Space':
      case 'ArrowUp':
        return 'flap';
      case 'KeyP':
        return 'pause';
      case 'KeyM':
        return 'mute';
      default:
        return undefined;
    }
  }
  if (raw.kind === 'pointerdown') {
    return raw.isPrimary === true && raw.button === 0 ? 'flap' : undefined;
  }
  return undefined;
}

/** File circulaire bornée et pré-allouée (ordre FIFO ; plein = rejet du plus récent). */
export interface ActionQueue {
  readonly capacity: number;
  size(): number;
  push(action: PlayerAction): boolean;
  drain(out: ActionBuffer): void;
}

export function createActionQueue(capacity: number): ActionQueue {
  const items: (PlayerAction | undefined)[] = new Array<PlayerAction | undefined>(capacity).fill(
    undefined,
  );
  let head = 0;
  let count = 0;
  return {
    capacity,
    size: () => count,
    push(action) {
      if (count >= capacity) return false;
      items[(head + count) % capacity] = action;
      count += 1;
      return true;
    },
    drain(out) {
      while (count > 0) {
        const action = items[head];
        items[head] = undefined;
        head = (head + 1) % capacity;
        count -= 1;
        if (action === 'flap') out.flap = true;
        else if (action === 'pause') out.pause = true;
        else if (action === 'mute') out.mute = true;
      }
    },
  };
}

/** Cible minimale d'écouteurs (window, document ou élément). */
export interface InputTarget {
  addEventListener(type: string, listener: (event: never) => void): void;
  removeEventListener(type: string, listener: (event: never) => void): void;
}

export interface InputModule {
  drain(out: ActionBuffer): void;
  dispose(): void;
}

interface KeyLike {
  code: string;
  repeat: boolean;
}
interface PointerLike {
  button: number;
  isPrimary: boolean;
}

export function createInput(target: InputTarget): InputModule {
  const queue = createActionQueue(GAME_CONFIG.INPUT_QUEUE_MAX);
  const raw: RawInput = { kind: 'keydown' };

  const onKeyDown = (e: KeyLike): void => {
    raw.kind = 'keydown';
    raw.code = e.code;
    raw.repeat = e.repeat;
    raw.button = undefined;
    raw.isPrimary = undefined;
    const action = mapRawInput(raw);
    if (action !== undefined) queue.push(action);
  };
  const onPointerDown = (e: PointerLike): void => {
    raw.kind = 'pointerdown';
    raw.code = undefined;
    raw.repeat = undefined;
    raw.button = e.button;
    raw.isPrimary = e.isPrimary;
    const action = mapRawInput(raw);
    if (action !== undefined) queue.push(action);
  };

  const keyListener = onKeyDown as (event: never) => void;
  const pointerListener = onPointerDown as (event: never) => void;
  target.addEventListener('keydown', keyListener);
  target.addEventListener('pointerdown', pointerListener);

  return {
    drain: (out) => queue.drain(out),
    dispose() {
      target.removeEventListener('keydown', keyListener);
      target.removeEventListener('pointerdown', pointerListener);
    },
  };
}
