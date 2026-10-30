/**
 * Palette de couleurs du rendu 2.5D (valeurs hexadÃ©cimales Three.js).
 * Toute couleur du rendu vient d'ici.
 */
export const PALETTE = {
  /** Fond de scÃ¨ne (identique au ciel). */
  BACKGROUND: 0x140b24,
  /** Corps de Kiro. */
  KIRO: 0xf3efff,
  KIRO_EYE: 0x1a1030,
  KIRO_HALO: 0xb48cff,
  KIRO_TRAIL: 0xd9ccff,
  KIRO_LIGHT: 0xb48cff,
  /** Corps des StÃ¨les (remplace OBSTACLE). */
  /** VisÃ© #5b5570, Ã©clairci : contraste >= CONTRAST_MIN exigÃ© contre dÃ©cor et brouillard. */
  STELE_BODY: 0x7d7596,
  STELE_CAP: 0x9a92b4,
  STELE_RIM: 0xff7518,
  FLOOR: 0x3b3352,
  CEILING: 0x3b3352,
  DECOR_SKY: 0x140b24,
  DECOR_FAR: 0x1b1030,
  DECOR_MID: 0x241640,
  DECOR_FOREGROUND: 0x0d0716,
  FOG: 0x2d1b4e,
  LIGHT_HEMI_SKY: 0x6b4ea0,
  LIGHT_HEMI_GROUND: 0x1a1030,
  LIGHT_MOON: 0xaec6ff,
  SHADOW: 0x05020a,
  /** Halloween (M4). */
  PUMPKIN: 0xff7518,
  PUMPKIN_GLOW: 0xffa040,
  MOON: 0xe8f0ff,
  MOON_HALO: 0x8fa8e8,
  ACCENT_PURPLE: 0x8a5cd6,
  DEAD_WOOD: 0x9c8068,
  GHOST_TINT: 0xffffff,
  /** Base neutre des matériaux dont la couleur est portée par l'instance. */
  WHITE: 0xffffff,
  DEBUG_HITBOX: 0xff4d6d,
  DEBUG_TEXT: '#ffffff',
} as const;


