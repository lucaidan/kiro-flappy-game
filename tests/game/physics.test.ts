import { describe, it, expect } from 'vitest';
import { GAME_CONFIG } from '../../src/config/game.config';
import {
  applyFlap,
  integrateKiro,
  resetKiro,
  validateConfig,
  type KiroState,
} from '../../src/game/physics';

const make = (): KiroState => ({ x: 1, y: 2, vy: 3, prevY: 0, prevVy: 0 });
const { GRAVITY, FLAP_VELOCITY, MAX_FALL_SPEED, FIXED_DT } = GAME_CONFIG;

describe('physique de Kiro', () => {
  it('applyFlap fixe la vitesse à FLAP_VELOCITY', () => {
    const k = make();
    applyFlap(k);
    expect(k.vy).toBe(FLAP_VELOCITY);
  });

  it('integrateKiro applique gravité puis intégration et mémorise le pas précédent', () => {
    const k = make();
    integrateKiro(k);
    const vy = 3 + GRAVITY * FIXED_DT;
    expect(k.prevY).toBe(2);
    expect(k.prevVy).toBe(3);
    expect(k.vy).toBeCloseTo(vy, 10);
    expect(k.y).toBeCloseTo(2 + vy * FIXED_DT, 10);
  });

  it('limite la vitesse de chute sans limiter la montée', () => {
    const fall = make();
    fall.vy = -1000;
    integrateKiro(fall);
    expect(fall.vy).toBe(-MAX_FALL_SPEED);

    const rise = make();
    rise.vy = 1000;
    integrateKiro(rise);
    expect(rise.vy).toBeGreaterThan(MAX_FALL_SPEED);
  });

  it('battement puis intégration : gravité appliquée après le battement', () => {
    const k = make();
    applyFlap(k);
    integrateKiro(k);
    expect(k.vy).toBeCloseTo(FLAP_VELOCITY + GRAVITY * FIXED_DT, 10);
  });

  it('resetKiro replace Kiro immobile à la position initiale', () => {
    const k = make();
    resetKiro(k);
    expect(k).toEqual({
      x: GAME_CONFIG.KIRO.START_X,
      y: GAME_CONFIG.KIRO.START_Y,
      vy: 0,
      prevY: GAME_CONFIG.KIRO.START_Y,
      prevVy: 0,
    });
  });

  it('validateConfig accepte la configuration par défaut', () => {
    expect(() => validateConfig({ GRAVITY, FLAP_VELOCITY, MAX_FALL_SPEED, FIXED_DT })).not.toThrow();
  });

  it('validateConfig nomme le paramètre invalide', () => {
    const base = { GRAVITY, FLAP_VELOCITY, MAX_FALL_SPEED, FIXED_DT };
    expect(() => validateConfig({ ...base, GRAVITY: NaN })).toThrow(/GRAVITY/);
    expect(() => validateConfig({ ...base, FIXED_DT: 0 })).toThrow(/FIXED_DT/);
    expect(() => validateConfig({ ...base, FIXED_DT: -1 })).toThrow(/FIXED_DT/);
    expect(() => validateConfig({ ...base, MAX_FALL_SPEED: Infinity })).toThrow(/MAX_FALL_SPEED/);
  });
});
