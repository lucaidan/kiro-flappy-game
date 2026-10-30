/** Bus d'événements typé, synchrone, sans dépendance au navigateur. */

export type GameStateName = 'Title' | 'Playing' | 'Paused' | 'GameOver';

export interface GameEvents {
  point: { score: number };
  stateChange: { from: GameStateName; to: GameStateName };
  gameOver: { score: number };
  muteChange: { muted: boolean };
  flap: { stepIndex: number };
}

export interface EventBus<E> {
  on<K extends keyof E>(name: K, fn: (p: E[K]) => void): () => void;
  emit<K extends keyof E>(name: K, payload: E[K]): void;
}

interface Subscription<P> {
  fn: (p: P) => void;
  active: boolean;
}

export function createEventBus<E>(
  onError?: (error: unknown) => void,
): EventBus<E> {
  // Copy-on-write : un tableau (instantané) par événement, reconstruit
  // uniquement à l'abonnement / au désabonnement.
  const subs = new Map<keyof E, Subscription<never>[]>();

  return {
    on<K extends keyof E>(name: K, fn: (p: E[K]) => void): () => void {
      const entry: Subscription<E[K]> = { fn, active: true };
      const current = subs.get(name) ?? [];
      subs.set(name, [...current, entry as Subscription<never>]);
      return () => {
        if (!entry.active) return;
        entry.active = false;
        const list = subs.get(name);
        if (list) {
          subs.set(
            name,
            list.filter((s) => s !== (entry as Subscription<never>)),
          );
        }
      };
    },

    emit<K extends keyof E>(name: K, payload: E[K]): void {
      const snapshot = subs.get(name) as Subscription<E[K]>[] | undefined;
      if (!snapshot) return;
      for (let i = 0; i < snapshot.length; i++) {
        const s = snapshot[i];
        if (s === undefined || !s.active) continue;
        try {
          s.fn(payload);
        } catch (error) {
          if (onError) {
            try {
              onError(error);
            } catch {
              // onError ne doit pas interrompre la livraison.
            }
          }
        }
      }
    },
  };
}
