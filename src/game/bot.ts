import { GAME_CONFIG } from '../config/game.config';
import type { ActionBuffer, World } from './state';

/**
 * État propre au Bot (jamais celui du moteur).
 * `lastIdleFlapStep` compte les pas écoulés depuis le dernier battement d'attente ;
 * une valeur négative signifie « aucun battement encore » (le prochain pas bat).
 */
export interface BotState {
  lastIdleFlapStep: number;
}

/** Crée un état de Bot neuf : le premier pas en Title/GameOver bat. */
export function createBotState(): BotState {
  return { lastIdleFlapStep: -1 };
}

/** Nombre de pas entre deux battements d'attente : ceil(500 / (FIXED_DT * 1000)). */
const IDLE_INTERVAL_STEPS = Math.ceil(
  GAME_CONFIG.BOT.IDLE_FLAP_INTERVAL_MS / (GAME_CONFIG.FIXED_DT * 1000),
);

const MID_Y = (GAME_CONFIG.WORLD.FLOOR + GAME_CONFIG.WORLD.CEILING) / 2;

/**
 * Décide du battement du pas courant. Lecture seule sur `world` (sans `rng`) ;
 * n'écrit que `out.flap` et l'état `bot`. État invalide : aucune action, aucune exception.
 */
export function botDecide(world: Readonly<World>, bot: BotState, out: ActionBuffer): void {
  out.flap = false;

  const kiro = world.kiro as { y?: unknown; vy?: unknown } | undefined;
  if (kiro === undefined || kiro === null) return;
  const y = kiro.y;
  const vy = kiro.vy;
  if (typeof y !== 'number' || typeof vy !== 'number' || !Number.isFinite(y) || !Number.isFinite(vy)) {
    return;
  }

  switch (world.phase) {
    case 'Title':
    case 'GameOver': {
      if (bot.lastIdleFlapStep < 0) {
        out.flap = true;
        bot.lastIdleFlapStep = 0;
        return;
      }
      bot.lastIdleFlapStep += 1;
      if (bot.lastIdleFlapStep >= IDLE_INTERVAL_STEPS) {
        out.flap = true;
        bot.lastIdleFlapStep = 0;
      }
      return;
    }
    case 'Playing': {
      // Le prochain passage en attente doit rebattre au premier pas.
      bot.lastIdleFlapStep = -1;
      const kiroX = world.kiro.x;
      if (!Number.isFinite(kiroX)) return;

      // Prochain obstacle : actif, bord droit à droite du bord gauche de Kiro, le plus proche.
      const kiroLeft = kiroX - GAME_CONFIG.KIRO.RADIUS;
      let target = MID_Y;
      let bestX = Infinity;
      for (const o of world.pool.items) {
        if (!o.active) continue;
        if (!Number.isFinite(o.x) || !Number.isFinite(o.gapCenterY)) return;
        if (o.x + GAME_CONFIG.OBSTACLE.WIDTH > kiroLeft && o.x < bestX) {
          bestX = o.x;
          target = o.gapCenterY;
        }
      }

      out.flap = y < target - GAME_CONFIG.BOT.TOLERANCE && vy <= 0;
      return;
    }
    default:
      return;
  }
}
