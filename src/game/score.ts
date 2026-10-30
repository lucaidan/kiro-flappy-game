import { GAME_CONFIG } from '../config/game.config';
import type { EventBus, GameEvents } from '../core/events';
import type { ObstaclePool } from './obstacles';

/**
 * Sous-ensemble structurel de `World` utilisé par le score
 * (compatible avec le `World` de state.ts).
 */
export interface ScoreWorld {
  kiro: { x: number };
  pool: ObstaclePool;
  score: number;
  bus: EventBus<GameEvents>;
}

/**
 * Incrémente le score une seule fois par obstacle franchi (bord droit strictement
 * à gauche du centre de Kiro) et publie `point` avec le nouveau score.
 */
export function updateScore(world: ScoreWorld): void {
  const kiroX = world.kiro.x;
  const items = world.pool.items;
  for (let i = 0; i < items.length; i++) {
    const o = items[i];
    if (o === undefined || !o.active || o.passed) continue;
    if (o.x + GAME_CONFIG.OBSTACLE.WIDTH < kiroX) {
      // `passed` est mutable à l'exécution ; le pool l'expose via un tableau readonly d'objets mutables.
      o.passed = true;
      world.score += 1;
      world.bus.emit('point', { score: world.score });
    }
  }
}
