import { GAME_CONFIG } from '../config/game.config';
import type { Rng } from '../core/rng';
import { acquire } from './obstacles';
import type { Obstacle, ObstaclePool } from './obstacles';

/** Demande d'activation (interface de remplacement future par le plan musical). */
export interface SpawnRequest {
  /** Distance déjà parcourue depuis le bord droit (SPAWN_X). */
  atDistance: number;
  /** Nombre de niveaux de quantification de `gapCenterY` (actif si ≥ 2). */
  gapLevels?: number;
}

/** Sous-ensemble structurel de `World` utilisé par le spawner. */
export interface SpawnerWorld {
  pool: ObstaclePool;
  rng: Rng;
  distanceSinceSpawn: number;
  activatedCount: number;
}

/**
 * Active un obstacle au bord droit du monde avec un centre d'ouverture tiré
 * dans les marges. Pool plein : retourne `undefined` sans consommer le RNG.
 */
export function spawnObstacle(pool: ObstaclePool, rng: Rng): Obstacle | undefined {
  const obstacle = acquire(pool);
  if (obstacle === undefined) return undefined;

  const halfGap = GAME_CONFIG.OBSTACLE.GAP_HEIGHT / 2;
  const min = GAME_CONFIG.WORLD.FLOOR + GAME_CONFIG.OBSTACLE.MIN_MARGIN + halfGap;
  const max = GAME_CONFIG.WORLD.CEILING - GAME_CONFIG.OBSTACLE.MIN_MARGIN - halfGap;

  obstacle.x = GAME_CONFIG.WORLD.RIGHT;
  obstacle.prevX = obstacle.x;
  // rng.float exige min < max ; le cas dégénéré min === max n'a qu'une valeur.
  obstacle.gapCenterY = min < max ? rng.float(min, max) : min;
  return obstacle;
}

/**
 * Accumule la distance de défilement d'un pas et active un obstacle chaque
 * fois que SPAWN_DISTANCE est atteinte. Incrémente `activatedCount` par activation.
 */
export function runDistanceSpawner(world: SpawnerWorld): void {
  world.distanceSinceSpawn += GAME_CONFIG.SCROLL_SPEED * GAME_CONFIG.FIXED_DT;
  while (world.distanceSinceSpawn >= GAME_CONFIG.OBSTACLE.SPAWN_DISTANCE) {
    world.distanceSinceSpawn -= GAME_CONFIG.OBSTACLE.SPAWN_DISTANCE;
    if (spawnObstacle(world.pool, world.rng) !== undefined) {
      world.activatedCount += 1;
    }
  }
}

/**
 * Applique une liste de demandes (0 à 1000). Retourne le nombre d'obstacles
 * effectivement activés ; l'appelant l'ajoute à `activatedCount`.
 */
export function applySpawnPlan(
  pool: ObstaclePool,
  rng: Rng,
  requests: readonly SpawnRequest[],
): number {
  const { WORLD, OBSTACLE } = GAME_CONFIG;
  const halfGap = OBSTACLE.GAP_HEIGHT / 2;
  const min = WORLD.FLOOR + OBSTACLE.MIN_MARGIN + halfGap;
  const max = WORLD.CEILING - OBSTACLE.MIN_MARGIN - halfGap;
  const maxDistance = WORLD.RIGHT - WORLD.LEFT;

  let activated = 0;
  for (let i = 0; i < requests.length; i++) {
    const req = requests[i]!;
    const obstacle = spawnObstacle(pool, rng);
    if (obstacle === undefined) continue;
    activated += 1;

    const advance = Math.min(Math.max(req.atDistance, 0), maxDistance);
    obstacle.x = WORLD.RIGHT - advance;
    obstacle.prevX = obstacle.x;

    const levels = req.gapLevels;
    if (levels !== undefined && levels >= 2 && max > min) {
      const n = Math.floor(levels);
      const t = (obstacle.gapCenterY - min) / (max - min);
      const idx = Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))));
      obstacle.gapCenterY = min + (idx * (max - min)) / (n - 1);
    }
  }
  return activated;
}
