import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../src/config/palette';
import { RENDER_CONFIG } from '../../src/config/render.config';

describe('config Halloween M4 (1.1, 2.3)', () => {
  it('les couches de décor incluent colline, église et arbre', () => {
    const shapes = RENDER_CONFIG.DECOR_LAYERS.map((l) => l.SHAPE);
    for (const s of ['hill', 'church', 'tree']) expect(shapes).toContain(s);
  });

  it('les couleurs thématiques existent dans la palette', () => {
    for (const key of ['PUMPKIN', 'PUMPKIN_GLOW', 'MOON', 'MOON_HALO', 'ACCENT_PURPLE', 'DEAD_WOOD', 'GHOST_TINT']) {
      expect(PALETTE).toHaveProperty(key);
    }
    expect(PALETTE).toHaveProperty(RENDER_CONFIG.OBSTACLE_THEME.EVEN);
    expect(PALETTE).toHaveProperty(RENDER_CONFIG.OBSTACLE_THEME.ODD);
  });
});
