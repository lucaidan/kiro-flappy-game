/**
 * Configuration centrale du jeu (Config_Jeu).
 * Toutes les valeurs sont des nombres finis ; POOL_SIZE est un entier dans [1, 64].
 * Unités : mètres monde et secondes. L'axe Y pointe vers le haut.
 */
export const GAME_CONFIG = {
  /** Pas fixe de simulation, en secondes. */
  FIXED_DT: 1 / 60,
  /** Plafond du Δt d'une image, en millisecondes. */
  MAX_FRAME_MS: 250,
  /** Gravité en unités/s² (négatif = vers le bas). */
  GRAVITY: -30,
  /** Vitesse verticale appliquée par un battement, vers le haut (unités/s). */
  FLAP_VELOCITY: 9,
  /** Vitesse de chute maximale, valeur positive (unités/s). */
  MAX_FALL_SPEED: 14,
  /** Vitesse de défilement des obstacles (unités/s). */
  SCROLL_SPEED: 4,
  WORLD: { LEFT: -8, RIGHT: 8, FLOOR: -5, CEILING: 5 },
  /** Position initiale et hitbox circulaire de Kiro. */
  KIRO: { START_X: -3, START_Y: 0, RADIUS: 0.4 },
  OBSTACLE: {
    WIDTH: 1.2,
    GAP_HEIGHT: 3.2,
    MIN_MARGIN: 0.6,
    /** Distance de défilement entre deux activations. */
    SPAWN_DISTANCE: 7,
  },
  /** Taille du pool d'obstacles : entier dans [1, 64]. */
  POOL_SIZE: 8,
  BOT: { TOLERANCE: 0.2, IDLE_FLAP_INTERVAL_MS: 500 },
  /** Taille maximale de la file d'actions du module d'entrée. */
  INPUT_QUEUE_MAX: 32,
} as const;
