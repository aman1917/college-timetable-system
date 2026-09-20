/**
 * Subject colour helpers, shared by every view and both export formats so a
 * subject looks identical on screen, in PDF and in Excel.
 */

export const SUBJECT_PALETTE = [
  '#6366f1', '#ec4899', '#22c55e', '#f59e0b', '#06b6d4', '#a855f7',
  '#ef4444', '#14b8a6', '#eab308', '#3b82f6', '#f97316', '#84cc16',
];

export function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '#999999').replace('#', '');
  if (clean.length !== 6) return [153, 153, 153];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/**
 * Pick black or white text for a background, using the perceptual luminance
 * weights rather than a naive average — a mid-green and a mid-blue of the same
 * numeric average need opposite text colours.
 */
export function contrastText(hex: string): '#111318' | '#ffffff' {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#111318' : '#ffffff';
}

/** Excel wants ARGB. */
export function toArgb(hex: string): string {
  return 'FF' + (hex || '#999999').replace('#', '').toUpperCase();
}

/** Stable colour suggestion for a new subject, from its code. */
export function suggestColor(seed: string): string {
  let hash = 0;
  for (const char of String(seed)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return SUBJECT_PALETTE[hash % SUBJECT_PALETTE.length];
}
