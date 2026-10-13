/** Wow Miam ! design tokens: jewel palette, fonts, brutal shadows. */

export const C = {
  paper: '#F4EFF3',
  ink: '#2A1530',
  tile: '#FFFFFF',
  muted: '#6A5C6E',
  onDark: '#FFF6FA',
  pink: '#D63B88',
  teal: '#007D72',
  amber: '#E0962A',
  coral: '#E55B3C',
  plum: '#8B4279',
  olive: '#8FA14B',
  navy: '#3A4570',
  aubergine: '#5B2B5C',
} as const;

export type Swatch = 'pink' | 'teal' | 'amber' | 'coral' | 'plum' | 'olive' | 'navy' | 'aubergine' | 'tile' | 'ink';

const DARK: ReadonlySet<Swatch> = new Set<Swatch>(['pink', 'teal', 'plum', 'navy', 'aubergine', 'ink']);

export const bg = (s: Swatch): string => C[s];
export const fg = (s: Swatch): string => (DARK.has(s) ? C.onDark : C.ink);

export const TILE_SWATCHES: readonly Swatch[] = ['pink', 'teal', 'amber', 'coral', 'plum', 'olive', 'navy'];
export const FOLDER_SWATCHES: readonly Swatch[] = ['amber', 'plum', 'teal', 'coral', 'navy', 'olive', 'pink'];

export const F = {
  display: 'BricolageGrotesque_800ExtraBold',
  body: 'Onest_400Regular',
  medium: 'Onest_500Medium',
  semi: 'Onest_600SemiBold',
  bold: 'Onest_700Bold',
} as const;

/** Mixes a hex colour toward ink; used for the back panel of a folder pocket. */
export function shade(hex: string, amount = 0.2): string {
  const mix = (a: number, b: number) => Math.round(a + (b - a) * amount);
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  const [ir, ig, ib] = [1, 3, 5].map((i) => Number.parseInt(C.ink.slice(i, i + 2), 16));
  return `#${[mix(r, ir), mix(g, ig), mix(b, ib)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export const hardShadow = (offset: number, color: string = C.ink): string => `${offset}px ${offset}px 0px ${color}`;
