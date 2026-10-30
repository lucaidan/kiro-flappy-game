import type { GameStateName } from '../core/events';

export type ScreenId = 'title' | 'hud' | 'paused' | 'gameOver';

const SCREENS: Readonly<Record<GameStateName, ScreenId>> = {
  Title: 'title',
  Playing: 'hud',
  Paused: 'paused',
  GameOver: 'gameOver',
};

/** Écran affiché pour une phase : un seul par phase. */
export function screenFor(phase: GameStateName): ScreenId {
  return SCREENS[phase];
}
