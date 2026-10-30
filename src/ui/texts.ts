/** Textes de l'interface, en français. Seul module qui les définit. */
export const TEXTS = {
  TITLE: 'Flappy Kiro',
  CONTROLS: {
    FLAP: 'Espace, flèche haut ou clic : battre des ailes',
    PAUSE: 'P : pause',
    MUTE: 'M : couper le son',
  },
  BEST_LABEL: 'Meilleur score',
  SCORE_LABEL: 'Score',
  FINAL_SCORE_LABEL: 'Score final',
  PAUSED: 'Pause',
  RESUME: 'Appuyez sur P pour reprendre',
  GAME_OVER: 'Game Over',
  REPLAY: 'Espace ou clic pour rejouer',
  START: 'Espace ou clic pour commencer',
  MUTE_BUTTON: 'Couper le son',
  UNMUTE_BUTTON: 'Activer le son',
  MUTE_LABEL: 'Son',
  GAME_OVER_ANNOUNCE: 'Partie terminée',
} as const;

/** Libellé d'un score, ex. « Score : 3 ». */
export function scoreText(label: string, value: number): string {
  return `${label} : ${value}`;
}
