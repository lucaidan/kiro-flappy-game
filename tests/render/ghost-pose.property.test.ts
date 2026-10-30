import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeGhostPose, hemOffset, type GhostPose } from '../../src/render/actors/ghost-pose';
import type { GhostClip } from '../../src/render/actors/ghost-sprite-frames';
import { RENDER_CONFIG } from '../../src/config/render.config';

const clips: GhostClip[] = ['float', 'flap', 'dissipate'];
const newPose = (): GhostPose => ({ armAngle: 0, armSway: 0, hemAmplitude: 0, opacity: 0, scale: 0 });
const timeArb = fc.double({ min: 0, max: 1e4, noNaN: true });
const EPS = 1e-9;

describe('Property 1: Pose bornée et immobile en mouvement réduit', () => {
  /** **Validates: Requirements 1.3, 6.1** */
  it('hemOffset est borné par ±HEM.AMPLITUDE et nul en mouvement réduit', () => {
    const A = RENDER_CONFIG.KIRO.HEM.AMPLITUDE;
    fc.assert(
      fc.property(
        fc.constantFrom(...clips),
        timeArb,
        timeArb,
        fc.double({ min: -100, max: 100, noNaN: true }),
        fc.boolean(),
        (clip, clipTime, wobbleTime, angle, reduced) => {
          const pose = computeGhostPose(clip, clipTime, reduced, newPose());
          const offset = hemOffset(angle, wobbleTime, pose.hemAmplitude);
          expect(Math.abs(offset)).toBeLessThanOrEqual(A + EPS);
          if (reduced) {
            expect(pose.hemAmplitude).toBe(0);
            expect(offset).toBe(0);
          }
        },
      ),
    );
  });
});

describe('Property 2: Le battement lève les bras', () => {
  /** **Validates: Requirements 1.4** */
  it('armAngle de flap > armAngle de float', () => {
    fc.assert(
      fc.property(timeArb, fc.boolean(), (t, reduced) => {
        const flap = computeGhostPose('flap', t, reduced, newPose());
        const float = computeGhostPose('float', t, reduced, newPose());
        expect(flap.armAngle).toBeGreaterThan(float.armAngle);
      }),
    );
  });
});

describe('Property 3: Dissipation monotone et réinitialisable', () => {
  /** **Validates: Requirements 1.5, 1.9** */
  it('opacité décroissante, échelle croissante >= 1 pour t1 <= t2', () => {
    fc.assert(
      fc.property(timeArb, timeArb, fc.boolean(), (a, b, reduced) => {
        const t1 = Math.min(a, b);
        const t2 = Math.max(a, b);
        const p1 = computeGhostPose('dissipate', t1, reduced, newPose());
        const p2 = computeGhostPose('dissipate', t2, reduced, newPose());
        expect(p2.opacity).toBeLessThanOrEqual(p1.opacity);
        expect(p1.opacity).toBeGreaterThanOrEqual(0);
        expect(p1.opacity).toBeLessThanOrEqual(1);
        expect(p2.opacity).toBeGreaterThanOrEqual(0);
        expect(p2.opacity).toBeLessThanOrEqual(1);
        expect(p2.scale).toBeGreaterThanOrEqual(p1.scale);
        expect(p1.scale).toBeGreaterThanOrEqual(1);
      }),
    );
  });

  it('float et flap ont opacité 1 et échelle 1', () => {
    fc.assert(
      fc.property(fc.constantFrom<GhostClip>('float', 'flap'), timeArb, fc.boolean(), (clip, t, reduced) => {
        const pose = computeGhostPose(clip, t, reduced, newPose());
        expect(pose.opacity).toBe(1);
        expect(pose.scale).toBe(1);
      }),
    );
  });
});
