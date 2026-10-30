import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Box3 } from 'three';
import { GAME_CONFIG } from '../../src/config/game.config';
import { RENDER_CONFIG } from '../../src/config/render.config';
import type { GameStateName } from '../../src/core/events';
import { computeKiroTilt, createKiroGhost } from '../../src/render/actors/kiro-ghost';
import { effectiveAlpha, interpolate } from '../../src/render/interpolation';

const posArb = fc.double({ min: -1e3, max: 1e3, noNaN: true });
// Alpha quelconque : NaN, infinis et hors [0, 1] inclus.
const alphaArb = fc.double({ noNaN: false });
const phaseArb = fc.constantFrom<GameStateName>('Title', 'Playing', 'Paused', 'GameOver');

// Feature: flappy-rendu-2-5d-m2, Property 8: Position de Kiro interpolée et corps aligné
describe('Property 8: Position de Kiro interpolée et corps aligné', () => {
  /**
   * **Validates: Requirements 3.2, 3.4, 8.2, 8.3, 8.5**
   */
  it('la position du groupe est l\'interpolation (x, y) et le corps a pour demi-taille RADIUS', () => {
    const kiro = createKiroGhost();
    const tol = RENDER_CONFIG.HITBOX_ALIGN_TOLERANCE;
    const radius = GAME_CONFIG.KIRO.RADIUS;
    try {
      fc.assert(
        fc.property(
          posArb,
          posArb,
          posArb,
          posArb,
          phaseArb,
          alphaArb,
          (px, py, cx, cy, phase, alpha) => {
            const a = effectiveAlpha(phase, alpha);
            const x = interpolate(px, cx, a);
            const y = interpolate(py, cy, a);
            kiro.update({ x, y, tilt: 0, wobbleTime: 0, clip: 'float', clipTime: 0, reducedMotion: true });

            expect(kiro.group.position.x).toBe(x);
            expect(kiro.group.position.y).toBe(y);
            expect(Number.isFinite(kiro.group.position.x)).toBe(true);
            expect(Number.isFinite(kiro.group.position.y)).toBe(true);

            // Hors Playing, la position dessinée est exactement l'état courant (8.3, 8.5).
            if (phase !== 'Playing') {
              // Tolérance : prev + (curr - prev) * 1 peut différer de curr d'un arrondi flottant.
              expect(Math.abs(kiro.group.position.x - cx)).toBeLessThanOrEqual(1e-9);
              expect(Math.abs(kiro.group.position.y - cy)).toBeLessThanOrEqual(1e-9);
            }

            // Boîte du corps en espace local, indépendante de la position du groupe.
            const box = new Box3().setFromObject(kiro.body);
            const local = box.translate(kiro.group.position.clone().negate());
            expect(Math.abs((local.max.x - local.min.x) / 2 - radius)).toBeLessThanOrEqual(tol);
            expect(Math.abs((local.max.y - local.min.y) / 2 - radius)).toBeLessThanOrEqual(tol);
          },
        ),
        { numRuns: 200 },
      );
    } finally {
      kiro.dispose();
    }
  });
});

// Feature: flappy-rendu-2-5d-m2, Property 9: Inclinaison de Kiro bornée et signée
describe('Property 9: Inclinaison de Kiro bornée et signée', () => {
  const tiltMax = RENDER_CONFIG.KIRO.TILT_MAX;

  /**
   * **Validates: Requirements 3.5, 3.6**
   */
  it('|tilt| <= TILT_MAX pour toute vitesse finie, et le signe suit vy', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (vy) => {
        const tilt = computeKiroTilt(vy);
        expect(Number.isFinite(tilt)).toBe(true);
        expect(Math.abs(tilt)).toBeLessThanOrEqual(tiltMax);
        if (vy === 0) expect(Math.abs(tilt)).toBe(0);
        // Les vy subnormales peuvent légitimement s'annuler après multiplication.
        else if (Math.abs(vy) >= 1e-6) expect(Math.sign(tilt)).toBe(Math.sign(vy));
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 3.5, 3.6**
   */
  it('renvoie 0 pour NaN et les infinis', () => {
    fc.assert(
      fc.property(fc.constantFrom(Number.NaN, Infinity, -Infinity), (vy) => {
        expect(computeKiroTilt(vy)).toBe(0);
      }),
      { numRuns: 100 },
    );
  });
});
