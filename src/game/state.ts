import { GAME_CONFIG } from '../config/game.config';
import type { EventBus, GameEvents, GameStateName } from '../core/events';
import { createRng } from '../core/rng';
import type { Rng } from '../core/rng';
import { detectCollision } from './collision';
import { createPool, releaseAll, scrollObstacles } from './obstacles';
import type { ObstaclePool } from './obstacles';
import { applyFlap, integrateKiro, resetKiro } from './physics';
import type { KiroState } from './physics';
import { updateScore } from './score';
import { applySpawnPlan, runDistanceSpawner } from './spawner';
import type { SpawnRequest } from './spawner';

export type { KiroState } from './physics';

/** État complet du monde, muté en place par `stepGame`. */
export interface World {
  phase: GameStateName;
  kiro: KiroState;
  pool: ObstaclePool;
  score: number;
  activatedCount: number;
  distanceSinceSpawn: number;
  stepIndex: number;
  muted: boolean;
  rng: Rng;
  bus: EventBus<GameEvents>;
  flapPending: boolean;
  /** Vitesse de défilement courante (unités/s). */
  scrollSpeed: number;
  spawnMode: 'distance' | 'time';
  /** Demandes à appliquer au prochain pas en Mode_Temps ; vidé après usage. */
  spawnPlan: SpawnRequest[];
}

/** Actions agrégées d'un pas (objet réutilisé ; plusieurs battements = un seul). */
export interface ActionBuffer {
  flap: boolean;
  pause: boolean;
  mute: boolean;
}

/** Table des transitions autorisées (7.10). */
const ALLOWED: Readonly<Record<GameStateName, readonly GameStateName[]>> = {
  Title: ['Playing'],
  Playing: ['Paused', 'GameOver'],
  Paused: ['Playing'],
  GameOver: ['Playing'],
};

/** Crée un monde en `Title`, Kiro immobile à sa position initiale. */
export function createWorld(options: {
  seed: number;
  muted: boolean;
  bus: EventBus<GameEvents>;
}): World {
  const kiro: KiroState = { x: 0, y: 0, vy: 0, prevY: 0, prevVy: 0 };
  resetKiro(kiro);
  return {
    phase: 'Title',
    kiro,
    pool: createPool(GAME_CONFIG.POOL_SIZE),
    score: 0,
    activatedCount: 0,
    // Le premier obstacle apparaît dès le premier pas de jeu.
    distanceSinceSpawn: GAME_CONFIG.OBSTACLE.SPAWN_DISTANCE,
    stepIndex: 0,
    muted: options.muted,
    rng: createRng(options.seed),
    bus: options.bus,
    flapPending: false,
    scrollSpeed: GAME_CONFIG.SCROLL_SPEED,
    spawnMode: 'distance',
    spawnPlan: [],
  };
}

/** Passe en Mode_Temps avec la vitesse de défilement donnée. */
export function setTimedSpawning(world: World, scrollSpeed: number): void {
  world.spawnMode = 'time';
  world.scrollSpeed = scrollSpeed;
}

/** Revient au Mode_Distance et à la vitesse par défaut. */
export function setDistanceSpawning(world: World): void {
  world.spawnMode = 'distance';
  world.scrollSpeed = GAME_CONFIG.SCROLL_SPEED;
}

/** Réinitialise la partie : Kiro, pool, score, distance de spawn et RNG (7.6). */
export function resetRun(world: World): void {
  resetKiro(world.kiro);
  releaseAll(world.pool);
  world.score = 0;
  world.activatedCount = 0;
  world.distanceSinceSpawn = GAME_CONFIG.OBSTACLE.SPAWN_DISTANCE;
  world.stepIndex = 0;
  world.flapPending = false;
  world.spawnPlan.length = 0;
  world.rng.reset();
}

/**
 * Change de phase si la transition est autorisée. Publie `stateChange` une fois,
 * puis `gameOver` en cas de passage à GameOver. Retourne `false` sinon, sans effet.
 */
export function transition(world: World, to: GameStateName): boolean {
  const from = world.phase;
  if (!ALLOWED[from].includes(to)) return false;
  world.phase = to;
  world.bus.emit('stateChange', { from, to });
  if (to === 'GameOver') {
    world.bus.emit('gameOver', { score: world.score });
  }
  return true;
}

function simulatePlaying(world: World, flap: boolean): void {
  const kiro = world.kiro;
  const prevY = kiro.y;
  const prevVy = kiro.vy;

  if (flap) {
    applyFlap(kiro);
    world.bus.emit('flap', { stepIndex: world.stepIndex });
  }
  integrateKiro(kiro);
  // Valeurs d'avant le pas (3.6), y compris avant le battement.
  kiro.prevY = prevY;
  kiro.prevVy = prevVy;

  scrollObstacles(world.pool, world.scrollSpeed);
  if (world.spawnMode === 'time') {
    world.activatedCount += applySpawnPlan(world.pool, world.rng, world.spawnPlan);
    world.spawnPlan.length = 0;
  } else {
    runDistanceSpawner(world);
  }
  world.stepIndex += 1;

  if (detectCollision(world)) {
    transition(world, 'GameOver');
    return;
  }
  updateScore(world);
}

/** Seul point d'entrée qui fait avancer la simulation d'un pas fixe. */
export function stepGame(world: World, actions: ActionBuffer): void {
  if (actions.mute) {
    world.muted = !world.muted;
    world.bus.emit('muteChange', { muted: world.muted });
  }

  switch (world.phase) {
    case 'Title':
      if (actions.flap && transition(world, 'Playing')) {
        simulatePlaying(world, true);
      } else {
        resetKiro(world.kiro);
      }
      return;
    case 'Playing':
      if (actions.pause) {
        transition(world, 'Paused');
        return;
      }
      simulatePlaying(world, actions.flap);
      return;
    case 'Paused':
      if (actions.pause) transition(world, 'Playing');
      return;
    case 'GameOver':
      if (actions.flap) {
        resetRun(world);
        transition(world, 'Playing');
      }
      return;
  }
}
