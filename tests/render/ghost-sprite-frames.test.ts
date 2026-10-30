import { describe, it, expect } from 'vitest';
import { RENDER_CONFIG } from '../../src/config/render.config';
import { selectClip } from '../../src/render/actors/ghost-sprite-frames';

const T = RENDER_CONFIG.KIRO.FLAP_VY_THRESHOLD;

describe('selectClip', () => {
  it('GameOver donne la dissipation, même avec vy élevé (4.4)', () => {
    expect(selectClip('GameOver', 0)).toBe('dissipate');
    expect(selectClip('GameOver', T + 10)).toBe('dissipate');
  });

  it('vy au-dessus du seuil donne le battement (4.4)', () => {
    expect(selectClip('Playing', T + 0.1)).toBe('flap');
  });

  it('au repos ou au seuil exact donne le flottement (4.4)', () => {
    expect(selectClip('Title', 0)).toBe('float');
    expect(selectClip('Playing', T)).toBe('float');
    expect(selectClip('Playing', -5)).toBe('float');
    expect(selectClip('Playing', Number.NaN)).toBe('float');
  });
});
