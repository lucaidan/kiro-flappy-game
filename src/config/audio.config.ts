export const AUDIO_CONFIG = {
  BPM: 120, // M4 : style visé 118–120 BPM
  BPM_MIN: 60,
  BPM_MAX: 180,
  TRAVEL_BEATS: 4, // entier
  TRAVEL_BEATS_MIN: 1,
  TRAVEL_BEATS_MAX: 16,
  BEATS_PER_BAR: 4,
  SPAWN_EVERY_BEATS: 4, // un obstacle par mesure
  BEAT_NOTATION: '4n', // intervalle du scheduleRepeat
  QUEUE_SIZE: 32,
  MAX_LATENESS_BEATS: 1, // au-delà, l'événement est périmé et ignoré
  GAP_LEVELS: 5, // niveaux de hauteur d'ouverture
  SCALE: { ROOT_MIDI: 62, STEPS: [0, 2, 3, 5, 7, 8, 10] }, // ré mineur naturel
  VOLUME_DB: {
    MASTER: -6,
    POINT: -10,
    MUSIC_KICK: -18,
    MUSIC_SNARE: -22,
    MUSIC_HAT: -30,
    MUSIC_BASS: -16,
    MUSIC_PAD: -28,
    MUSIC_LEAD: -20,
    MUSIC_BELL: -26,
    MUSIC_LAUGH: -28,
    FLAP: -24,
  },
} as const;
