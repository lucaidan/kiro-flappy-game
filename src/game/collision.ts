import { GAME_CONFIG } from '../config/game.config';
import { obstacleRects } from './obstacles';
import type { ObstaclePool, RectPair } from './obstacles';

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface Rect {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

/**
 * Vue structurelle minimale de `World` (state.ts, tâche 7.1) ; `World` y est assignable.
 */
export interface CollisionWorld {
  readonly phase: string;
  readonly kiro: { readonly x: number; readonly y: number };
  readonly pool: ObstaclePool;
}

/** Paire de rectangles réutilisée à chaque appel (aucune allocation par appel). */
const scratch: RectPair = {
  top: { left: 0, right: 0, bottom: 0, top: 0 },
  bottom: { left: 0, right: 0, bottom: 0, top: 0 },
};

const scratchCircle: Circle = { x: 0, y: 0, r: 0 };

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Cercle contre rectangle : comparaison sur les carrés, tangence incluse (5.1). */
export function circleHitsRect(c: Circle, r: Rect): boolean {
  const dx = c.x - clamp(c.x, r.left, r.right);
  const dy = c.y - clamp(c.y, r.bottom, r.top);
  return dx * dx + dy * dy <= c.r * c.r;
}

/** Contact avec le sol ou le plafond, tangence incluse (5.2, 5.3). */
export function hitsBounds(c: Circle, floor: number, ceiling: number): boolean {
  return c.y - c.r <= floor || c.y + c.r >= ceiling;
}

/** Renvoie un booléen unique ; `false` hors `Playing` (5.8, 5.9). */
export function detectCollision(world: CollisionWorld): boolean {
  if (world.phase !== 'Playing') return false;

  const circle = scratchCircle;
  circle.x = world.kiro.x;
  circle.y = world.kiro.y;
  circle.r = GAME_CONFIG.KIRO.RADIUS;
  if (hitsBounds(circle, GAME_CONFIG.WORLD.FLOOR, GAME_CONFIG.WORLD.CEILING)) return true;

  for (const o of world.pool.items) {
    if (!o.active) continue;
    obstacleRects(o, scratch);
    if (circleHitsRect(circle, scratch.top) || circleHitsRect(circle, scratch.bottom)) {
      return true;
    }
  }
  return false;
}
