/**
 * Config_Rendu : constantes du rendu 2.5D (dimensions visuelles, pas de réglage de jeu).
 * Les couleurs viennent de `PALETTE` ; `COLOR` des couches nomme une clé de `PALETTE`.
 */
export const RENDER_CONFIG = {
  /** Marge visible autour de la Zone_Jeu, en unités monde. */
  VIEW_MARGIN: 0.5,
  /** Plafond du ratio de pixels du renderer. */
  MAX_PIXEL_RATIO: 2,
  /** Marge pour la précision flottante 32 bits des matrices d'instances. */
  HITBOX_ALIGN_TOLERANCE: 1e-5,
  /** Contraste minimal (WCAG) entre éléments. */
  CONTRAST_MIN: 3,
  /** Budget d'appels de dessin par image. */
  MAX_DRAW_CALLS: 40,
  /** Budget de triangles par image. */
  MAX_TRIANGLES: 20000,
  /** Images par seconde minimales pour le bot. */
  FPS_MIN_BOT: 55,
  /** Taille maximale de la carte d'ombre. */
  SHADOW_MAP_SIZE_MAX: 2048,
  /** Champ de vision vertical, en degrés. */
  FOV_DEG: 40,
  /** Coefficient du Suivi_Vertical. */
  FOLLOW_Y: 0.3,
  /** Hauteur du chapiteau des Stèles. */
  CAP_HEIGHT: 0.5,
  /** Hauteur maximale du premier plan au-dessus du sol. */
  FOREGROUND_MAX_HEIGHT: 0.2,
  CAMERA: {
    YAW_DEG: 10,
    PITCH_DEG: 8,
    TILT_MAX_DEG: 15,
    AIM_AHEAD_X: 3,
    MIN_DISTANCE: 10,
    NEAR_MIN: 0.1,
    DEPTH_SAFETY: 1.1,
    ASPECT_COVER_MAX: 8,
    FALLBACK_ASPECT: 1,
    RAY_EPSILON: 0.001,
  },
  KIRO: {
    SEGMENTS_W: 24,
    SEGMENTS_H: 16,
    BODY_DEPTH_SCALE: 0.8,
    EYE_RADIUS: 0.07,
    EYE_OFFSET_X: 0.14,
    EYE_OFFSET_Y: 0.08,
    EYE_Z: 0.27,
    TILT_PER_SPEED: 0.04,
    TILT_MAX: 0.5,
    /** Vitesse verticale au-dessus de laquelle Kiro bat des bras. */
    FLAP_VY_THRESHOLD: 2,
    /** Bas ondulant : déplacement vertical des sommets bas du corps. */
    HEM: {
      AMPLITUDE: 0.06,
      FREQUENCY_HZ: 1.2,
      /** Sommets dont y normalisé (dans [-1, 1]) est sous cette valeur ondulent. */
      RING_FROM_Y: -0.2,
      /** Nombre de lobes autour du corps. */
      LOBES: 5,
    },
    /** Bras : capsules pivotant autour de l'épaule. */
    ARM: {
      LENGTH: 0.22,
      RADIUS: 0.05,
      SHOULDER_X: 0.3,
      SHOULDER_Y: -0.05,
      /** Angle au repos (flottement), rad depuis l'horizontale, vers le bas. */
      ANGLE_DOWN: -0.6,
      /** Angle au battement, vers le haut. */
      ANGLE_UP: 0.9,
      SWAY: 0.12,
      SWAY_HZ: 1.5,
    },
    /** Yeux ovales : rayons de la sphère étirée. */
    EYE: {
      RADIUS_X: 0.05,
      RADIUS_Y: 0.085,
      RADIUS_Z: 0.04,
    },
    /** Dissipation à la mort. */
    DISSIPATE: {
      DURATION: 0.6,
      SCALE_END: 1.5,
    },
  },
  HALO: {
    RADIUS: 0.95,
    OPACITY: 0.22,
    Z: -0.15,
  },
  STELE: {
    DEPTH: 1,
    RIM_HEIGHT: 0.08,
    RIM_Z_OFFSET: 0.02,
  },
  BOUNDARY: {
    THICKNESS: 0.5,
    DEPTH: 3,
  },
  /** Couches de décor derrière le Plan_Jeu : facteurs dans [0, 1[, décroissants avec la profondeur. */
  DECOR_LAYERS: [
    {
      Z: -40,
      PARALLAX: 0.05,
      PERIOD: 60,
      SHAPE: 'plane',
      WIDTH: 60,
      HEIGHT: 44,
      BASE_Y: -22,
      COLOR: 'DECOR_SKY',
    },
    {
      Z: -28,
      PARALLAX: 0.3,
      PERIOD: 14,
      SHAPE: 'hill',
      WIDTH: 16,
      HEIGHT: 6,
      BASE_Y: -6,
      COLOR: 'DECOR_FAR',
    },
    {
      Z: -21,
      PARALLAX: 0.45,
      PERIOD: 11,
      SHAPE: 'church',
      WIDTH: 2.4,
      HEIGHT: 6,
      BASE_Y: -5.5,
      COLOR: 'DECOR_FAR',
    },
    {
      Z: -14,
      PARALLAX: 0.6,
      PERIOD: 7,
      SHAPE: 'tree',
      WIDTH: 1.4,
      HEIGHT: 5,
      BASE_Y: -5,
      COLOR: 'DECOR_MID',
    },
  ],
  /** Lune : disque et halo additif derrière le décor. */
  MOON: {
    X: 4,
    Y: 3.5,
    Z: -36,
    RADIUS: 2,
    HALO_RADIUS: 4,
    HALO_OPACITY: 0.25,
    SEGMENTS: 48,
    PARALLAX: 0.02,
  },
  /** Variantes d'obstacle selon la parité du Slot (sans RNG). */
  OBSTACLE_THEME: {
    FACE_RADIUS: 0.3,
    FACE_Z_OFFSET: 0.03,
    FACE_SEGMENTS: 24,
    EVEN: 'STELE_BODY',
    ODD: 'DEAD_WOOD',
  },
  /** Touffes de premier plan (hors Couche_Decor, facteur > 1). */
  FOREGROUND: {
    Z: 1,
    PARALLAX: 1.2,
    PERIOD: 1.6,
    SHAPE: 'cone',
    WIDTH: 0.6,
    HEIGHT: 0.8,
    BASE_Y: -5.6,
    COLOR: 'DECOR_FOREGROUND',
  },
  FOG: {
    NEAR_OFFSET: 4,
    FAR_OFFSET: 70,
  },
  LIGHT: {
    HEMI_INTENSITY: 0.9,
    MAIN_INTENSITY: 2,
    MAIN_POSITION: { x: -6, y: 8, z: 14 },
    KIRO_INTENSITY: 14,
    KIRO_DISTANCE: 7,
    KIRO_DECAY: 2,
    KIRO_OFFSET_Z: 1.5,
  },
  SHADOW: {
    MAP_SIZE: 1024,
    CAMERA_HALF: 12,
    NEAR: 1,
    FAR: 40,
    BIAS: -0.0005,
    NORMAL_BIAS: 0.02,
    OPACITY: 0.35,
    RECEIVER_Z: -2.5,
  },
  ANIM: {
    MAX_DT: 0.1,
  },
  DEBUG: {
    CIRCLE_SEGMENTS: 32,
    RENDER_ORDER: 1000,
  },
} as const;
