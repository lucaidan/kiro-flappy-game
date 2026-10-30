import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createEventBus } from '../../src/core/events';
import type { GameEvents, GameStateName } from '../../src/core/events';
import type { ActionBuffer } from '../../src/game/state';
import { RENDER_CONFIG } from '../../src/config/render.config';
import { contrastRatio } from '../../src/render/contrast';
import { createHud } from '../../src/ui/hud';
import { BEST_SCORE_KEY } from '../../src/ui/best-score';
import { TEXTS } from '../../src/ui/texts';

// ---------- Faux DOM minimal ----------
type Listener = (e: FakeEvent) => void;

interface FakeEvent {
  type: string;
  stopped: boolean;
  stopPropagation(): void;
}

class FakeElement {
  tagName: string;
  className = '';
  hidden = false;
  type = '';
  children: FakeElement[] = [];
  attrs = new Map<string, string>();
  listeners = new Map<string, Listener[]>();
  private text = '';
  constructor(
    tag: string,
    public ownerDocument: FakeDocument,
  ) {
    this.tagName = tag;
  }
  get textContent(): string {
    return this.children.length > 0 ? this.children.map((c) => c.textContent).join('') : this.text;
  }
  set textContent(v: string) {
    this.text = v;
  }
  appendChild(c: FakeElement): FakeElement {
    this.children.push(c);
    return c;
  }
  replaceChildren(): void {
    this.children = [];
  }
  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v);
  }
  getAttribute(k: string): string | null {
    return this.attrs.get(k) ?? null;
  }
  addEventListener(t: string, fn: Listener): void {
    this.listeners.set(t, [...(this.listeners.get(t) ?? []), fn]);
  }
  removeEventListener(t: string, fn: Listener): void {
    this.listeners.set(
      t,
      (this.listeners.get(t) ?? []).filter((f) => f !== fn),
    );
  }
  dispatch(type: string): FakeEvent {
    const e: FakeEvent = {
      type,
      stopped: false,
      stopPropagation() {
        e.stopped = true;
      },
    };
    for (const fn of this.listeners.get(type) ?? []) fn(e);
    return e;
  }
  find(pred: (e: FakeElement) => boolean): FakeElement | undefined {
    if (pred(this)) return this;
    for (const c of this.children) {
      const r = c.find(pred);
      if (r) return r;
    }
    return undefined;
  }
}

class FakeDocument {
  hidden = false;
  listeners = new Map<string, Listener[]>();
  createElement(tag: string): FakeElement {
    return new FakeElement(tag, this);
  }
  addEventListener(t: string, fn: Listener): void {
    this.listeners.set(t, [...(this.listeners.get(t) ?? []), fn]);
  }
  removeEventListener(t: string, fn: Listener): void {
    this.listeners.set(
      t,
      (this.listeners.get(t) ?? []).filter((f) => f !== fn),
    );
  }
  fire(t: string): void {
    for (const fn of this.listeners.get(t) ?? []) fn({ type: t, stopped: false, stopPropagation() {} });
  }
}

class FakeWindow {
  listeners = new Map<string, Listener[]>();
  constructor(public document: FakeDocument) {}
  addEventListener(t: string, fn: Listener): void {
    this.listeners.set(t, [...(this.listeners.get(t) ?? []), fn]);
  }
  removeEventListener(t: string, fn: Listener): void {
    this.listeners.set(
      t,
      (this.listeners.get(t) ?? []).filter((f) => f !== fn),
    );
  }
  fire(t: string): void {
    for (const fn of this.listeners.get(t) ?? []) fn({ type: t, stopped: false, stopPropagation() {} });
  }
}

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

function setup(opts: { initialMuted?: boolean } = {}) {
  const doc = new FakeDocument();
  const win = new FakeWindow(doc);
  const root = doc.createElement('div');
  const bus = createEventBus<GameEvents>();
  const actions: ActionBuffer = { flap: false, pause: false, mute: false };
  const storage = fakeStorage();
  const hud = createHud({
    root: root as unknown as HTMLElement,
    bus,
    actions,
    storage: storage as unknown as Storage,
    target: win as unknown as Parameters<typeof createHud>[0]['target'],
    ...opts,
  });
  const section = (cls: string) => root.find((e) => e.className === cls)!;
  const goto = (from: GameStateName, to: GameStateName) => bus.emit('stateChange', { from, to });
  return { doc, win, root, bus, actions, storage, hud, section, goto };
}

describe('HUD : écrans et événements', () => {
  it('affiche seulement l’écran titre au départ', () => {
    const { section } = setup();
    expect(section('screen screen-title').hidden).toBe(false);
    expect(section('screen screen-hud').hidden).toBe(true);
    expect(section('screen screen-paused').hidden).toBe(true);
    expect(section('screen screen-gameover').hidden).toBe(true);
  });

  it('suit stateChange, point et gameOver', () => {
    const { section, bus, goto, storage } = setup();
    goto('Title', 'Playing');
    expect(section('screen screen-hud').hidden).toBe(false);
    expect(section('screen screen-title').hidden).toBe(true);
    bus.emit('point', { score: 3 });
    expect(section('screen screen-hud').textContent).toContain('Score : 3');
    goto('Playing', 'Paused');
    expect(section('screen screen-paused').hidden).toBe(false);
    goto('Paused', 'Playing');
    expect(section('screen screen-hud').textContent).toContain('Score : 3');
    bus.emit('gameOver', { score: 3 });
    goto('Playing', 'GameOver');
    const over = section('screen screen-gameover');
    expect(over.hidden).toBe(false);
    expect(over.textContent).toContain('Score final : 3');
    expect(over.textContent).toContain('Meilleur score : 3');
    expect(storage.data.get(BEST_SCORE_KEY)).toBe('3');
  });

  it('remet le score à zéro à une nouvelle partie', () => {
    const { section, bus, goto } = setup();
    goto('Title', 'Playing');
    bus.emit('point', { score: 5 });
    bus.emit('gameOver', { score: 5 });
    goto('Playing', 'GameOver');
    goto('GameOver', 'Playing');
    expect(section('screen screen-hud').textContent).toContain('Score : 0');
  });

  it('dispose retire les abonnements', () => {
    const { root, bus, hud, goto, actions, win } = setup();
    goto('Title', 'Playing');
    hud.dispose();
    expect(root.children).toEqual([]);
    expect(() => bus.emit('point', { score: 9 })).not.toThrow();
    win.fire('blur');
    expect(actions.pause).toBe(false);
  });
});

describe('HUD : mute', () => {
  it('le bouton pose mute sans flap et arrête la propagation', () => {
    const { root, actions } = setup();
    const btn = root.find((e) => e.tagName === 'button')!;
    const down = btn.dispatch('pointerdown');
    expect(down.stopped).toBe(true);
    expect(actions.flap).toBe(false);
    const click = btn.dispatch('click');
    expect(click.stopped).toBe(true);
    expect(actions.mute).toBe(true);
    expect(actions.flap).toBe(false);
  });

  it('reflète muteChange dans le libellé et aria-pressed', () => {
    const { root, bus } = setup();
    const btn = root.find((e) => e.tagName === 'button')!;
    expect(btn.textContent).toBe(TEXTS.MUTE_BUTTON);
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    bus.emit('muteChange', { muted: true });
    expect(btn.textContent).toBe(TEXTS.UNMUTE_BUTTON);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('respecte initialMuted', () => {
    const { root } = setup({ initialMuted: true });
    const btn = root.find((e) => e.tagName === 'button')!;
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('HUD : pause automatique', () => {
  it('pause à la perte de visibilité et au blur en Playing', () => {
    const a = setup();
    a.goto('Title', 'Playing');
    a.doc.hidden = true;
    a.doc.fire('visibilitychange');
    expect(a.actions.pause).toBe(true);

    const b = setup();
    b.goto('Title', 'Playing');
    b.win.fire('blur');
    expect(b.actions.pause).toBe(true);
  });

  it.each<GameStateName>(['Title', 'Paused', 'GameOver'])('pas de pause auto en %s', (phase) => {
    const s = setup();
    if (phase === 'Paused') {
      s.goto('Title', 'Playing');
      s.goto('Playing', 'Paused');
    } else if (phase === 'GameOver') {
      s.goto('Title', 'Playing');
      s.goto('Playing', 'GameOver');
    }
    s.doc.hidden = true;
    s.doc.fire('visibilitychange');
    s.win.fire('blur');
    expect(s.actions.pause).toBe(false);
  });

  it('visibilitychange sans masquage ne met pas en pause', () => {
    const s = setup();
    s.goto('Title', 'Playing');
    s.doc.fire('visibilitychange');
    expect(s.actions.pause).toBe(false);
  });
});

describe('HUD : ARIA', () => {
  it('expose une région aria-live polite en role status', () => {
    const { root } = setup();
    const live = root.find((e) => e.getAttribute('aria-live') !== null)!;
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.getAttribute('role')).toBe('status');
  });

  it('annonce la pause et la fin de partie', () => {
    const { root, bus, goto } = setup();
    const live = root.find((e) => e.getAttribute('aria-live') !== null)!;
    goto('Title', 'Playing');
    goto('Playing', 'Paused');
    expect(live.textContent).toBe(TEXTS.PAUSED);
    goto('Paused', 'Playing');
    bus.emit('gameOver', { score: 4 });
    expect(live.textContent).toContain(TEXTS.GAME_OVER_ANNOUNCE);
    expect(live.textContent).toContain('Score final : 4');
  });
});

describe('HUD : contraste (index.html)', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const hex = (s: string) => parseInt(s.replace('#', ''), 16);

  const textColor = hex(/#ui\s*{[^}]*?color:\s*(#[0-9a-fA-F]{6})/.exec(html)![1]!);

  /** Mélange alpha d’un voile rgba sur un fond 0xRRGGBB. */
  function over(rgba: string, bg: number): number {
    const m = /rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)/.exec(rgba)!;
    const a = Number(m[4]);
    const ch = (v: string, shift: number) =>
      Math.round(Number(v) * a + ((bg >> shift) & 0xff) * (1 - a));
    return (ch(m[1]!, 16) << 16) | (ch(m[2]!, 8) << 8) | ch(m[3]!, 0);
  }

  const overlay = /\.screen-title\s*{[^}]*background:\s*(rgba\([^)]*\))/.exec(html)![1]!;
  const button = /\.mute-button\s*{[^}]*background:\s*(rgba\([^)]*\))/.exec(html)![1]!;

  it.each([
    ['voile des écrans', overlay],
    ['bouton de mute', button],
  ])('texte clair sur %s ≥ CONTRAST_MIN, même sur fond blanc ou noir', (_n, rgba) => {
    for (const canvas of [0xffffff, 0x000000]) {
      expect(contrastRatio(textColor, over(rgba, canvas))).toBeGreaterThanOrEqual(
        RENDER_CONFIG.CONTRAST_MIN,
      );
    }
  });
});
