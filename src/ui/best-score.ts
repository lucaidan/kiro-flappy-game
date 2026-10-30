export const BEST_SCORE_KEY = 'flappy-kiro:best';

function parse(raw: string | null | undefined): number {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return 0;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : 0;
}

/** Lit le meilleur score ; 0 si stockage absent, qui lève ou valeur invalide. */
export function loadBest(storage: Pick<Storage, 'getItem'> | undefined): number {
  if (storage === undefined) return 0;
  try {
    return parse(storage.getItem(BEST_SCORE_KEY));
  } catch {
    return 0;
  }
}

/** Enregistre `score` s'il dépasse le meilleur ; retourne le meilleur courant. */
export function saveBest(
  storage: Pick<Storage, 'setItem' | 'getItem'> | undefined,
  score: number,
): number {
  const candidate = Number.isSafeInteger(score) && score > 0 ? score : 0;
  const best = Math.max(loadBest(storage), candidate);
  if (storage !== undefined && best > loadBest(storage)) {
    try {
      storage.setItem(BEST_SCORE_KEY, String(best));
    } catch {
      // Stockage indisponible : on garde le meilleur en mémoire.
    }
  }
  return best;
}
