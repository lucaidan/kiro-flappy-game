import type { EventBus, GameEvents, GameStateName } from '../core/events';
import type { ActionBuffer } from '../game/state';
import { loadBest, saveBest } from './best-score';
import { screenFor } from './screen-view';
import type { ScreenId } from './screen-view';
import { TEXTS, scoreText } from './texts';

export interface HudOptions {
  root: HTMLElement;
  bus: EventBus<GameEvents>;
  /** Pause et mute y sont posés. */
  actions: ActionBuffer;
  storage?: Storage;
  target: Pick<Window, 'addEventListener'> & {
    document: Pick<Document, 'addEventListener' | 'hidden'>;
  };
  /** État initial du mute (par défaut : faux). */
  initialMuted?: boolean;
}

const SCREEN_IDS: readonly ScreenId[] = ['title', 'hud', 'paused', 'gameOver'];

export function createHud(options: HudOptions): { dispose(): void } {
  const { root, bus, actions, storage, target } = options;
  const doc = root.ownerDocument;

  const el = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    parent: HTMLElement,
    text?: string,
    className?: string,
  ): HTMLElementTagNameMap[K] => {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className !== undefined) node.className = className;
    parent.appendChild(node);
    return node;
  };

  let phase: GameStateName = 'Title';
  let score = 0;
  let best = loadBest(storage);
  let muted = options.initialMuted ?? false;

  // Score en cours (HUD).
  const screens: Record<ScreenId, HTMLElement> = {
    title: el('section', root, undefined, 'screen screen-title'),
    hud: el('section', root, undefined, 'screen screen-hud'),
    paused: el('section', root, undefined, 'screen screen-paused'),
    gameOver: el('section', root, undefined, 'screen screen-gameover'),
  };

  const hudScore = el('p', screens.hud, undefined, 'score');

  el('h1', screens.title, TEXTS.TITLE);
  el('p', screens.title, TEXTS.START);
  el('p', screens.title, TEXTS.CONTROLS.FLAP);
  el('p', screens.title, TEXTS.CONTROLS.PAUSE);
  el('p', screens.title, TEXTS.CONTROLS.MUTE);
  const titleBest = el('p', screens.title);

  el('h1', screens.paused, TEXTS.PAUSED);
  el('p', screens.paused, TEXTS.RESUME);

  el('h1', screens.gameOver, TEXTS.GAME_OVER);
  const finalScore = el('p', screens.gameOver);
  const overBest = el('p', screens.gameOver);
  el('p', screens.gameOver, TEXTS.REPLAY);

  // Bouton de mute : ne doit pas déclencher de battement.
  const muteButton = el('button', root, undefined, 'mute-button');
  muteButton.type = 'button';
  const onMutePointerDown = (event: Event): void => {
    event.stopPropagation();
  };
  const onMuteClick = (event: Event): void => {
    event.stopPropagation();
    actions.mute = true;
  };
  muteButton.addEventListener('pointerdown', onMutePointerDown);
  muteButton.addEventListener('click', onMuteClick);

  // Région d'annonce pour lecteurs d'écran.
  const live = el('div', root, undefined, 'sr-only');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('role', 'status');

  const render = (): void => {
    const visible = screenFor(phase);
    for (const id of SCREEN_IDS) screens[id].hidden = id !== visible;
    hudScore.textContent = scoreText(TEXTS.SCORE_LABEL, score);
    titleBest.textContent = scoreText(TEXTS.BEST_LABEL, best);
    finalScore.textContent = scoreText(TEXTS.FINAL_SCORE_LABEL, score);
    overBest.textContent = scoreText(TEXTS.BEST_LABEL, best);
    muteButton.textContent = muted ? TEXTS.UNMUTE_BUTTON : TEXTS.MUTE_BUTTON;
    muteButton.setAttribute('aria-pressed', muted ? 'true' : 'false');
  };

  const offs: (() => void)[] = [];
  offs.push(
    bus.on('point', (p) => {
      score = p.score;
      render();
    }),
    bus.on('stateChange', ({ from, to }) => {
      phase = to;
      if (to === 'Playing' && from !== 'Paused') score = 0;
      if (to === 'Paused') live.textContent = TEXTS.PAUSED;
      render();
    }),
    bus.on('gameOver', (p) => {
      score = p.score;
      best = saveBest(storage, p.score);
      live.textContent = `${TEXTS.GAME_OVER_ANNOUNCE}. ${scoreText(TEXTS.FINAL_SCORE_LABEL, p.score)}`;
      render();
    }),
    bus.on('muteChange', (p) => {
      muted = p.muted;
      render();
    }),
  );

  // Pause automatique : uniquement en Playing.
  const onVisibility = (): void => {
    if (target.document.hidden && phase === 'Playing') actions.pause = true;
  };
  const onBlur = (): void => {
    if (phase === 'Playing') actions.pause = true;
  };
  target.document.addEventListener('visibilitychange', onVisibility);
  target.addEventListener('blur', onBlur);

  render();

  return {
    dispose(): void {
      for (const off of offs) off();
      muteButton.removeEventListener('pointerdown', onMutePointerDown);
      muteButton.removeEventListener('click', onMuteClick);
      const d = target.document as Partial<Document>;
      d.removeEventListener?.('visibilitychange', onVisibility);
      (target as Partial<Window>).removeEventListener?.('blur', onBlur);
      root.replaceChildren();
    },
  };
}
