/** Coefficients et seuils de la norme WCAG 2.x (luminance relative et contraste). */
const SRGB_LINEAR_THRESHOLD = 0.04045;
const SRGB_LINEAR_DIVISOR = 12.92;
const SRGB_GAMMA_OFFSET = 0.055;
const SRGB_GAMMA_DIVISOR = 1.055;
const SRGB_GAMMA_EXPONENT = 2.4;
const LUMINANCE_R = 0.2126;
const LUMINANCE_G = 0.7152;
const LUMINANCE_B = 0.0722;
const CONTRAST_OFFSET = 0.05;
const CHANNEL_MAX = 255;

/** Linéarise un canal sRGB 8 bits (0 à 255). */
function linearizeChannel(channel8: number): number {
  const c = channel8 / CHANNEL_MAX;
  return c <= SRGB_LINEAR_THRESHOLD
    ? c / SRGB_LINEAR_DIVISOR
    : Math.pow((c + SRGB_GAMMA_OFFSET) / SRGB_GAMMA_DIVISOR, SRGB_GAMMA_EXPONENT);
}

/**
 * Luminance relative WCAG d'une couleur 0xRRGGBB, dans [0, 1].
 * @param hex Couleur au format 0xRRGGBB.
 */
export function relativeLuminance(hex: number): number {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return (
    LUMINANCE_R * linearizeChannel(r) +
    LUMINANCE_G * linearizeChannel(g) +
    LUMINANCE_B * linearizeChannel(b)
  );
}

/**
 * Rapport de contraste (L1 + 0,05) / (L2 + 0,05) avec L1 >= L2, dans [1, 21].
 * Symétrique : ordonne elle-même les deux luminances.
 * @param a Première couleur 0xRRGGBB.
 * @param b Seconde couleur 0xRRGGBB.
 */
export function contrastRatio(a: number, b: number): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + CONTRAST_OFFSET) / (darker + CONTRAST_OFFSET);
}
