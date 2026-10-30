import { GAME_CONFIG } from '../config/game.config';

/** État physique de Kiro (réexporté par state.ts). */
export interface KiroState {
  x: number;
  y: number;
  vy: number;
  /** Position et vitesse du pas précédent, pour l'interpolation de rendu. */
  prevY: number;
  prevVy: number;
}

/** Paramètres physiques validables. */
export interface PhysicsConfig {
  GRAVITY: number;
  FLAP_VELOCITY: number;
  MAX_FALL_SPEED: number;
  FIXED_DT: number;
}

/** Battement : fixe la vitesse verticale vers le haut (3.2). */
export function applyFlap(kiro: KiroState): void {
  kiro.vy = GAME_CONFIG.FLAP_VELOCITY;
}

/**
 * Un pas fixe : gravité, limite de chute (sans limiter la montée), puis intégration (3.1, 3.3).
 * Le battement doit être appliqué avant cet appel.
 */
export function integrateKiro(kiro: KiroState): void {
  kiro.prevY = kiro.y;
  kiro.prevVy = kiro.vy;
  kiro.vy += GAME_CONFIG.GRAVITY * GAME_CONFIG.FIXED_DT;
  kiro.vy = Math.max(kiro.vy, -GAME_CONFIG.MAX_FALL_SPEED);
  kiro.y += kiro.vy * GAME_CONFIG.FIXED_DT;
}

/** Replace Kiro immobile à sa position initiale (3.5). */
export function resetKiro(kiro: KiroState): void {
  kiro.x = GAME_CONFIG.KIRO.START_X;
  kiro.y = GAME_CONFIG.KIRO.START_Y;
  kiro.vy = 0;
  kiro.prevY = kiro.y;
  kiro.prevVy = 0;
}

/** Lève une Error nommant le paramètre invalide (3.8). Ne modifie aucun état. */
export function validateConfig(config: PhysicsConfig): void {
  const keys: (keyof PhysicsConfig)[] = ['GRAVITY', 'FLAP_VELOCITY', 'MAX_FALL_SPEED', 'FIXED_DT'];
  for (const key of keys) {
    const value = config[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`configuration invalide : ${key} doit être un nombre fini`);
    }
  }
  if (config.FIXED_DT <= 0) {
    throw new Error('configuration invalide : FIXED_DT doit être > 0');
  }
}
