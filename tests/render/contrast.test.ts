import { describe, it, expect } from 'vitest';
import { contrastRatio, relativeLuminance } from '../../src/render/contrast';
import { PALETTE } from '../../src/config/palette';
import { RENDER_CONFIG } from '../../src/config/render.config';

const { CONTRAST_MIN } = RENDER_CONFIG;

const foregrounds = {
  STELE_BODY: PALETTE.STELE_BODY,
  STELE_CAP: PALETTE.STELE_CAP,
  STELE_RIM: PALETTE.STELE_RIM,
  KIRO: PALETTE.KIRO,
};

const layers = {
  DECOR_SKY: PALETTE.DECOR_SKY,
  DECOR_FAR: PALETTE.DECOR_FAR,
  DECOR_MID: PALETTE.DECOR_MID,
  DECOR_FOREGROUND: PALETTE.DECOR_FOREGROUND,
};

describe('Contraste WCAG', () => {
  it('noir sur blanc vaut 21', () => {
    expect(contrastRatio(0x000000, 0xffffff)).toBeCloseTo(21, 10);
  });

  it('deux couleurs identiques valent 1', () => {
    expect(contrastRatio(0x7d7596, 0x7d7596)).toBe(1);
  });

  it('CONTRAST_MIN est au moins 3', () => {
    expect(CONTRAST_MIN).toBeGreaterThanOrEqual(3);
  });

  describe.each(Object.entries(foregrounds))('%s', (_fgName, fg) => {
    it.each(Object.entries(layers))('contraste >= CONTRAST_MIN contre %s', (_name, layer) => {
      expect(contrastRatio(fg, layer)).toBeGreaterThanOrEqual(CONTRAST_MIN);
    });

    it('contraste >= CONTRAST_MIN contre FOG', () => {
      expect(contrastRatio(fg, PALETTE.FOG)).toBeGreaterThanOrEqual(CONTRAST_MIN);
    });
  });

  it('les couches de décor et le brouillard sont plus sombres que Stèles et Kiro', () => {
    const dark = [...Object.values(layers), PALETTE.FOG].map(relativeLuminance);
    const bright = Object.values(foregrounds).map(relativeLuminance);
    expect(Math.max(...dark)).toBeLessThan(Math.min(...bright));
  });
});
