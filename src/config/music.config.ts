/**
 * Boucle musicale de 8 mesures en ré mineur (funk-disco sombre).
 * Motifs originaux composés pour ce projet. Grille : 16 doubles-croches par mesure.
 */
export const MUSIC_CONFIG = {
  STEPS_PER_BEAT: 4,
  LOOP_BARS: 8,
  /** Fondamentales (MIDI) des 8 mesures : Dm Dm Bb C Dm Gm Bb A. */
  CHORD_ROOTS: [50, 50, 46, 48, 50, 43, 46, 45],
  CHORD_TYPES: ['min', 'min', 'maj', 'maj', 'min', 'min', 'maj', 'maj'],
  /** Vélocités par double-croche (0 = silence). Grosse caisse sur le temps 1. */
  KICK: [1, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 0.8, 0, 0, 0, 0, 0],
  SNARE: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.4],
  HAT: [0.5, 0.2, 0.7, 0.2, 0.5, 0.2, 0.7, 0.3, 0.5, 0.2, 0.7, 0.2, 0.5, 0.3, 0.8, 0.3],
  /** Décalage en demi-tons depuis la fondamentale (0, 7 ou 12), -1 = silence. */
  BASS: [0, -1, 0, -1, -1, 12, -1, 7, 0, -1, 12, -1, 7, -1, 0, -1],
  /** Pas de la basse joués comme notes fantômes (vélocité GHOST_NOTE_VELOCITY). */
  BASS_GHOST_STEPS: [2, 14],
  /** 8 mesures × 16 pas : note MIDI, 0 = silence. */
  LEAD: [
    [69, 0, 0, 65, 0, 0, 62, 0, 0, 0, 65, 0, 69, 0, 0, 0],
    [72, 0, 0, 69, 0, 0, 65, 0, 0, 0, 0, 0, 62, 0, 0, 0],
    [70, 0, 0, 65, 0, 0, 62, 0, 0, 0, 65, 0, 70, 0, 0, 0],
    [72, 0, 0, 67, 0, 0, 64, 0, 0, 0, 67, 0, 72, 0, 0, 0],
    [74, 0, 0, 72, 0, 0, 69, 0, 0, 0, 65, 0, 69, 0, 0, 0],
    [70, 0, 0, 67, 0, 0, 62, 0, 0, 0, 67, 0, 70, 0, 0, 0],
    [74, 0, 0, 70, 0, 0, 65, 0, 0, 0, 62, 0, 65, 0, 0, 0],
    [73, 0, 0, 69, 0, 0, 64, 0, 0, 0, 69, 0, 73, 0, 0, 0],
  ],
  FX: { ENABLED: true, BELL_BARS: [3, 7], LAUGH_BAR: 7 },
  GHOST_NOTE_VELOCITY: 0.3,
} as const;
