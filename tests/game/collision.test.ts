import { describe, expect, it } from 'vitest';
import { circleHitsRect, detectCollision, hitsBounds } from '../../src/game/collision';
import type { Rect } from '../../src/game/collision';
import { createPool } from '../../src/game/obstacles';

const rect: Rect = { left: 0, right: 1, bottom: 0, top: 1 };

describe('circleHitsRect', () => {
  it('détecte la tangence sur une face (5.1)', () => {
    expect(circleHitsRect({ x: -0.5, y: 0.5, r: 0.5 }, rect)).toBe(true);
    expect(circleHitsRect({ x: 0.5, y: 1.5, r: 0.5 }, rect)).toBe(true);
  });

  it('ne détecte rien juste au-delà de la tangence', () => {
    expect(circleHitsRect({ x: -0.5001, y: 0.5, r: 0.5 }, rect)).toBe(false);
  });

  it('détecte la tangence exacte sur un coin (3-4-5)', () => {
    expect(circleHitsRect({ x: -3, y: -4, r: 5 }, rect)).toBe(true);
  });

  it('ne détecte rien juste avant le coin', () => {
    expect(circleHitsRect({ x: -3, y: -4, r: 4.99 }, rect)).toBe(false);
  });

  it('détecte un centre à l’intérieur du rectangle', () => {
    expect(circleHitsRect({ x: 0.5, y: 0.5, r: 0.1 }, rect)).toBe(true);
  });
});

describe('hitsBounds', () => {
  it('touche le sol en tangence (5.2)', () => {
    expect(hitsBounds({ x: 0, y: -4.5, r: 0.5 }, -5, 5)).toBe(true);
  });

  it('ne touche pas le sol juste au-dessus', () => {
    expect(hitsBounds({ x: 0, y: -4.49, r: 0.5 }, -5, 5)).toBe(false);
  });

  it('touche le plafond en tangence (5.3)', () => {
    expect(hitsBounds({ x: 0, y: 4.5, r: 0.5 }, -5, 5)).toBe(true);
  });

  it('ne touche pas le plafond juste en dessous', () => {
    expect(hitsBounds({ x: 0, y: 4.49, r: 0.5 }, -5, 5)).toBe(false);
  });
});

describe('detectCollision', () => {
  function makeWorld(phase: string, y: number) {
    const pool = createPool(2);
    const o = pool.items[0];
    if (o === undefined) throw new Error('pool vide');
    o.active = true;
    o.x = 5;
    o.gapCenterY = 0;
    return { phase, kiro: { x: 0, y }, pool };
  }

  it('retourne false pour Kiro libre dans la zone de jeu', () => {
    expect(detectCollision(makeWorld('Playing', 0))).toBe(false);
  });

  it('retourne true au sol et au plafond', () => {
    expect(detectCollision(makeWorld('Playing', -4.7))).toBe(true);
    expect(detectCollision(makeWorld('Playing', 4.7))).toBe(true);
  });

  it('retourne true contre un obstacle actif', () => {
    const w = makeWorld('Playing', 3);
    const o = w.pool.items[0];
    if (o === undefined) throw new Error('pool vide');
    o.x = -0.5;
    expect(detectCollision(w)).toBe(true);
  });

  it('ignore les obstacles inactifs', () => {
    const w = makeWorld('Playing', 3);
    const o = w.pool.items[0];
    if (o === undefined) throw new Error('pool vide');
    o.x = -0.5;
    o.active = false;
    expect(detectCollision(w)).toBe(false);
  });

  it('retourne false hors Playing', () => {
    expect(detectCollision(makeWorld('Paused', -4.7))).toBe(false);
    expect(detectCollision(makeWorld('GameOver', -4.7))).toBe(false);
  });
});
