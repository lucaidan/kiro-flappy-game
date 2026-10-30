import { GAME_CONFIG } from '../config/game.config';

/** Rectangle aligné sur les axes (compatible avec `Rect` de collision.ts). */
export interface ObstacleRect {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

/** Paire de rectangles d'un obstacle, fournie et réutilisée par l'appelant. */
export interface RectPair {
  top: ObstacleRect;
  bottom: ObstacleRect;
}

/** Un obstacle du pool ; `x` est son bord gauche. */
export interface Obstacle {
  active: boolean;
  x: number;
  prevX: number;
  gapCenterY: number;
  passed: boolean;
}

export interface ObstaclePool {
  /** Longueur fixe égale à la taille du pool. */
  readonly items: readonly Obstacle[];
}

const MIN_POOL_SIZE = 1;
const MAX_POOL_SIZE = 64;

/**
 * Crée un pool d'obstacles inactifs. Seule allocation du module.
 * @throws Error si `size` n'est pas un entier dans [1, 64].
 */
export function createPool(size: number): ObstaclePool {
  if (!Number.isInteger(size) || size < MIN_POOL_SIZE || size > MAX_POOL_SIZE) {
    throw new Error(`Taille de pool invalide : ${String(size)} (entier dans [1, 64] attendu)`);
  }
  const items: Obstacle[] = [];
  for (let i = 0; i < size; i++) {
    items.push({ active: false, x: 0, prevX: 0, gapCenterY: 0, passed: false });
  }
  return { items };
}

/**
 * Active le premier obstacle libre et le retourne, ou `undefined` si le pool est plein.
 * Réinitialise `passed` ; place `x` et `prevX` au bord droit du monde.
 */
export function acquire(pool: ObstaclePool): Obstacle | undefined {
  for (const o of pool.items) {
    if (!o.active) {
      o.active = true;
      o.passed = false;
      o.x = GAME_CONFIG.WORLD.RIGHT;
      o.prevX = o.x;
      o.gapCenterY = 0;
      return o;
    }
  }
  return undefined;
}

/**
 * Fait défiler les obstacles actifs d'un pas fixe et désactive ceux dont le bord
 * droit est strictement à gauche du bord gauche du monde.
 */
export function scrollObstacles(
  pool: ObstaclePool,
  speed: number = GAME_CONFIG.SCROLL_SPEED,
): void {
  const dx = speed * GAME_CONFIG.FIXED_DT;
  for (const o of pool.items) {
    if (!o.active) continue;
    o.prevX = o.x;
    o.x -= dx;
    if (o.x + GAME_CONFIG.OBSTACLE.WIDTH < GAME_CONFIG.WORLD.LEFT) {
      o.active = false;
    }
  }
}

/** Désactive tous les obstacles du pool. */
export function releaseAll(pool: ObstaclePool): void {
  for (const o of pool.items) {
    o.active = false;
    o.passed = false;
  }
}

/** Remplit `out` avec les rectangles haut et bas de l'obstacle, sans allocation. */
export function obstacleRects(obstacle: Obstacle, out: RectPair): void {
  const half = GAME_CONFIG.OBSTACLE.GAP_HEIGHT / 2;
  const left = obstacle.x;
  const right = obstacle.x + GAME_CONFIG.OBSTACLE.WIDTH;

  out.bottom.left = left;
  out.bottom.right = right;
  out.bottom.bottom = GAME_CONFIG.WORLD.FLOOR;
  out.bottom.top = obstacle.gapCenterY - half;

  out.top.left = left;
  out.top.right = right;
  out.top.bottom = obstacle.gapCenterY + half;
  out.top.top = GAME_CONFIG.WORLD.CEILING;
}
