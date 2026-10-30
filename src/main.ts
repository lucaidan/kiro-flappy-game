import { createBeatQueue } from './audio/beat-queue';
import { createConductor } from './audio/conductor';
import type { Conductor } from './audio/conductor';
import { createMusicDirector } from './audio/music/music-director';
import { createSfx } from './audio/sfx';
import { createToneAdapter } from './audio/tone-adapter';
import { deriveScrollSpeed } from './audio/timing/beat-math';
import type { BeatEvent, TempoParams } from './audio/timing/beat-math';
import { buildSpawnPlan } from './audio/timing/spawn-plan';
import { AUDIO_CONFIG } from './config/audio.config';
import { GAME_CONFIG } from './config/game.config';
import { createEventBus } from './core/events';
import type { GameEvents } from './core/events';
import { createLoop, startLoop } from './core/loop';
import { parseUrlParams } from './core/url-params';
import { botDecide, createBotState } from './game/bot';
import { createWorld, setDistanceSpawning, setTimedSpawning, stepGame } from './game/state';
import type { ActionBuffer } from './game/state';
import { createInput } from './input/input';
import type { AudioDebugInfo } from './render/debug/debug-overlay';
import { createRenderer2_5D } from './render/renderer';
import { createHud } from './ui/hud';

/** Source de graine confinée à main.ts (le moteur n'utilise jamais l'horloge). */
const seedFromTime = (): number => Date.now() % 4294967296;

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Canvas #game introuvable');
}

const params = parseUrlParams(location.search, seedFromTime);
const bus = createEventBus<GameEvents>((error) => console.error(error));
// `mute` mémorisé dans le monde (11.4) ; aucun son joué en M1 (11.7).
const world = createWorld({ seed: params.seed, muted: params.mute, bus });
const input = createInput({
  addEventListener: (type, listener) => window.addEventListener(type, listener as EventListener),
  removeEventListener: (type, listener) =>
    window.removeEventListener(type, listener as EventListener),
});

// --- Audio (M3) : rien n'est créé si `mute` ; le Mode_Distance reste alors actif. ---
const tempo: TempoParams = {
  bpm: AUDIO_CONFIG.BPM,
  travelBeats: AUDIO_CONFIG.TRAVEL_BEATS,
  spawnX: GAME_CONFIG.WORLD.RIGHT,
  playerX: GAME_CONFIG.KIRO.START_X,
};
// Valide la configuration au démarrage (RangeError explicite), jamais pendant le jeu.
const timedScrollSpeed = deriveScrollSpeed(tempo);

let conductor: Conductor | undefined;
if (!params.mute) {
  const adapter = createToneAdapter();
  conductor = createConductor(adapter.api, createBeatQueue(AUDIO_CONFIG.QUEUE_SIZE));
  createSfx(bus, adapter.voices);
  const director = createMusicDirector(conductor, adapter.musicVoices);
  const c = conductor;

  const unlockEvents = ['pointerdown', 'keydown', 'touchstart'] as const;
  const onFirstGesture = (): void => {
    for (const type of unlockEvents) window.removeEventListener(type, onFirstGesture);
    c.unlock().catch((error: unknown) => {
      console.error(error);
    });
  };
  for (const type of unlockEvents) window.addEventListener(type, onFirstGesture);

  bus.on('stateChange', ({ from, to }) => {
    if (to === 'Playing' && (from === 'Title' || from === 'GameOver')) c.restart();
    else if (to === 'Playing' && from === 'Paused') c.resume();
    else if (to === 'Paused') c.pause();
    else if (to === 'GameOver') c.stop();
    if (to === 'Paused' || to === 'GameOver') director.stopAll();
  });
  bus.on('muteChange', ({ muted }) => c.setMuted(muted));
}

// Tampons préalloués réutilisés à chaque pas.
const dueEvents: BeatEvent[] = [];
const audioInfo: AudioDebugInfo = {
  bpm: AUDIO_CONFIG.BPM,
  beatIndex: 0,
  scrollSpeed: 0,
  queueSize: 0,
};
const getAudioInfo = (): AudioDebugInfo | null => {
  if (conductor === undefined) return null;
  audioInfo.beatIndex = conductor.beatIndex;
  audioInfo.scrollSpeed = world.scrollSpeed;
  audioInfo.queueSize = conductor.queue.size;
  return audioInfo;
};

const renderer = createRenderer2_5D({ canvas, world, debug: params.debug, getAudioInfo });
const bot = params.bot ? createBotState() : undefined;
const actions: ActionBuffer = { flap: false, pause: false, mute: false };

const uiRoot = document.getElementById('ui');
if (uiRoot !== null) {
  createHud({
    root: uiRoot,
    bus,
    actions,
    storage: (() => {
      try {
        return window.localStorage;
      } catch {
        return undefined;
      }
    })(),
    target: window,
    initialMuted: params.mute,
  });
}

const loop = createLoop(
  { fixedDtSeconds: GAME_CONFIG.FIXED_DT, maxFrameMs: GAME_CONFIG.MAX_FRAME_MS },
  () => {
    input.drain(actions);
    if (bot !== undefined) botDecide(world, bot, actions);
    if (conductor !== undefined) {
      if (conductor.isRunning()) {
        if (world.spawnMode === 'distance') setTimedSpawning(world, timedScrollSpeed);
        if (world.phase === 'Playing') {
          const audioNow = conductor.now();
          dueEvents.length = 0;
          conductor.queue.drainDue(audioNow, dueEvents);
          buildSpawnPlan(dueEvents, audioNow, tempo, world.spawnPlan);
        }
      } else if (world.spawnMode === 'time') {
        setDistanceSpawning(world);
      }
    }
    stepGame(world, actions);
    actions.flap = false;
    actions.pause = false;
    actions.mute = false;
  },
);

window.addEventListener('resize', () => renderer.resize());

startLoop(
  loop,
  { now: () => performance.now(), schedule: (cb) => requestAnimationFrame(cb) },
  (alpha) => renderer.render(alpha),
);
