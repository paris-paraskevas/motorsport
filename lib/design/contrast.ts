// WCAG 2.x contrast, the arithmetic only: relative luminance from sRGB and the
// (L1 + 0.05) / (L2 + 0.05) ratio. Client-safe and pure, so the themes editor
// can show a ratio as a colour is typed and the write route can refuse the same
// value with the same number.

const HEX = /^#([0-9a-f]{6})$/i;

export function isHexColour(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value);
}

/** Lower-case #rrggbb, or null when the value is not one. */
export function normaliseHex(value: unknown): string | null {
  return isHexColour(value) ? value.toLowerCase() : null;
}

function channel(hex: string, at: number): number {
  const c = parseInt(hex.slice(at, at + 2), 16) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a #rrggbb colour, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const h = hex.toLowerCase();
  return 0.2126 * channel(h, 1) + 0.7152 * channel(h, 3) + 0.0722 * channel(h, 5);
}

/** WCAG contrast ratio between two #rrggbb colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** One decimal, the way WCAG figures are usually quoted. */
export function formatRatio(ratio: number): string {
  return `${(Math.round(ratio * 10) / 10).toFixed(1)}:1`;
}
