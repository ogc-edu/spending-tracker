/**
 * Design tokens for new UI (Dark and Light themes) and backward-compatible Obsidian/Porcelain palettes.
 *
 * Precedence: newUIDesign/design.jsonc > mockups/theme.css
 */

export const darkTheme = {
  bg: '#000000',
  tabbar: '#0B0B0C',
  surface: '#111113',
  fill: '#1C1C1E',
  fillStrong: '#2C2C2E',
  sheet: '#1C1C1E',
  separator: '#1C1C1E',
  separatorStrong: '#2A2A2E',
  chipBorder: '#2C2C2E',
  track: '#2A2A2E',
  handle: '#48484A',
  scrim: 'rgba(0,0,0,0.6)',
  text: '#F5F5F7',
  textSecondary: '#A1A1A6',
  textTertiary: '#8E8E93',
  accent: '#F5B83D',
  onAccent: '#000000',
  emphasis: '#F5B83D',
  link: '#F5B83D',
  selectedBg: '#2A2416',
  // Calendar selected day: amber disc in dark; light grey disc + bold ink in light (a solid ink/green
  // disc swallowed the number and fought the airy sheet).
  daySelectedBg: '#F5B83D',
  onDaySelected: '#000000',
  switchOff: '#3A3A3C',
  segmentTrack: '#1C1C1E',
  segmentThumb: '#3A3A3C',
  chartActive: '#F5B83D',
  chartMax: '#8A6A26',
  chartIdle: '#3A3A3C',
  barMuted: '#8E8E93',
  danger: '#FF6961',
  cardShadow: '0 -6 14 rgba(0,0,0,0.55)',
} as const;

export const lightTheme = {
  bg: '#F2F2F2',
  tabbar: '#FFFFFF',
  surface: '#FFFFFF',
  fill: '#FFFFFF',
  fillStrong: '#EBEBEB',
  sheet: '#FFFFFF',
  separator: '#E4E4E4',
  separatorStrong: '#E4E4E4',
  chipBorder: '#E0E0E0',
  track: '#E9E9E9',
  handle: '#D1D1D6',
  scrim: 'rgba(0,0,0,0.35)',
  text: '#111111',
  textSecondary: '#55555A',
  textTertiary: '#6C6C70',
  accent: '#111111',
  onAccent: '#FFFFFF',
  emphasis: '#111111',
  link: '#111111',
  selectedBg: '#F4F4F4',
  daySelectedBg: '#E2E2E4',
  onDaySelected: '#111111',
  switchOff: '#E0E0E0',
  segmentTrack: '#E8E8E8',
  segmentThumb: '#FFFFFF',
  chartActive: '#5FD3A0',
  chartMax: '#A9E7CA',
  chartIdle: '#E3F6EC',
  barMuted: '#C7C7CC',
  danger: '#C5221F',
  cardShadow: '0 -4 12 rgba(0,0,0,0.12)',
} as const;

export const themes = {
  dark: darkTheme,
  light: lightTheme,
} as const;

export type ThemeTokens = {
  [K in keyof typeof darkTheme]: string;
};

/**
 * Account card colours. Each account type owns a hue family so the type still reads at a glance
 * (blue = bank, teal/green = cash, violet = e-wallet, graphite = credit card, rust = pay later);
 * accounts of the same type step through the family's shades so two banks never render as one
 * slab in the Wallet stack. Every shade keeps #FFFFFF ≥ 6:1 and the 0.8-opacity secondary text
 * ≥ 4.5:1 (asserted in tokens.test.ts). Shade 0 is the design.jsonc colour, except credit_card dark
 * (cooled from #3A3A3C, which is the switchOff/segmentThumb grey and read as disabled) and pay later
 * (darkened from #B8430F so the 0.8 caption passes AA).
 */
export const accountCardShades = {
  bank: { dark: ['#24408F', '#1D5E9E', '#3A2F86'], light: ['#24408F', '#1D5E9E', '#3A2F86'] },
  cash: { dark: ['#0E6B63', '#2D6834', '#53601A'], light: ['#0E6B63', '#2D6834', '#53601A'] },
  ewallet: { dark: ['#5A3E9E', '#7A3690', '#8C2F63'], light: ['#5A3E9E', '#7A3690', '#8C2F63'] },
  credit_card: { dark: ['#3A4150', '#5A2A3A', '#4A3F2C'], light: ['#1F1F21', '#4A1F2C', '#3A3122'] },
  paylater: { dark: ['#A63C0C', '#A8322D', '#8F500E'], light: ['#A63C0C', '#A8322D', '#8F500E'] },
} as const;

export type AccountCardType = keyof typeof accountCardShades;

/** Shade 0 of each family — the colour a lone account of that type gets. */
export const accountCards = Object.fromEntries(
  Object.entries(accountCardShades).map(([type, s]) => [type, { dark: s.dark[0], light: s.light[0] }]),
) as { [K in AccountCardType]: { dark: string; light: string } };

/** Card colour for an account; `shade` wraps around the family. Unknown types fall back to bank. */
export function accountCardColor(type: string, scheme: 'dark' | 'light', shade = 0): string {
  const family = (accountCardShades as Record<string, { dark: readonly string[]; light: readonly string[] }>)[type]
    ?? accountCardShades.bank;
  const list = family[scheme];
  return list[((shade % list.length) + list.length) % list.length]!;
}

/**
 * Shade index per account id: the n-th account of a type (by ascending id) gets shade n. Keyed by
 * creation order, so adding an account never recolours existing ones and every screen agrees even
 * when it shows a type-filtered subset.
 */
export function accountShades(accounts: readonly { id: number; type: string }[]): Map<number, number> {
  const byType = new Map<string, number[]>();
  for (const a of accounts) {
    const ids = byType.get(a.type) ?? [];
    ids.push(a.id);
    byType.set(a.type, ids);
  }
  const shades = new Map<number, number>();
  for (const ids of byType.values()) {
    ids.sort((x, y) => x - y).forEach((id, i) => shades.set(id, i));
  }
  return shades;
}

export const onCard = {
  text: '#FFFFFF',
  textSoftOpacity: 0.8,
  hairline: 'rgba(255,255,255,0.22)',
  // Pill text takes the card's own colour (≥ 4.5:1 on white by construction above).
  payButton: { bg: '#FFFFFF' },
  paidPill: { bg: 'rgba(0,0,0,0.25)', text: '#FFFFFF' },
} as const;

export interface CategoryPaletteItem {
  seed: string;
  darkFg: string;
  lightTile: string;
  lightFg: string;
}

export const categoryPalette: readonly CategoryPaletteItem[] = [
  { seed: 'Food', darkFg: '#F5B83D', lightTile: '#FBE6B4', lightFg: '#5C3F00' },
  { seed: 'Groceries', darkFg: '#7FC8A9', lightTile: '#CDEFDF', lightFg: '#0F5135' },
  { seed: 'Transport', darkFg: '#7AA7FF', lightTile: '#D9E6FF', lightFg: '#173E8C' },
  { seed: 'Entertainment', darkFg: '#FF9F5A', lightTile: '#FFE2CC', lightFg: '#7A3510' },
  { seed: 'Shopping', darkFg: '#F28FB1', lightTile: '#F9D7E3', lightFg: '#7A1F43' },
  { seed: 'Bills', darkFg: '#C3A6FF', lightTile: '#E6DCFF', lightFg: '#45297F' },
  { seed: 'Health', darkFg: '#FF8A7A', lightTile: '#FFDCD6', lightFg: '#84261A' },
  { seed: 'Education', darkFg: '#6FD3E0', lightTile: '#D3F2F6', lightFg: '#0E5560' },
  { seed: 'Travel', darkFg: '#B7D96A', lightTile: '#E7F3CC', lightFg: '#3E5410' },
  { seed: 'Gifts', darkFg: '#E0A387', lightTile: '#F5E1D8', lightFg: '#6B3A25' },
  { seed: 'Debt / Repayment', darkFg: '#9FB4C7', lightTile: '#E1E7EE', lightFg: '#2E4052' },
  { seed: 'Other', darkFg: '#A1A1A6', lightTile: '#E6E6E8', lightFg: '#3A3A3C' },
] as const;

export const obsidian = {
  background: '#090B10',
  card: '#121620',
  cardForeground: '#F8FAFC',
  border: '#21293A',
  borderSubtle: '#18202F',
  input: '#1D2433',
  primary: '#10B981',
  primaryForeground: '#022C22',
  destructive: '#F43F5E',
  warning: '#F59E0B',
  muted: '#1A2130',
  mutedForeground: '#7C8BA1',
  accent: '#06B6D4',
} as const;

export const porcelain = {
  background: '#F8FAFC',
  card: '#FFFFFF',
  cardForeground: '#0F172A',
  border: '#E2E8F0',
  borderSubtle: '#F1F5F9',
  input: '#F1F5F9',
  primary: '#059669',
  primaryForeground: '#FFFFFF',
  destructive: '#E11D48',
  warning: '#D97706',
  muted: '#F1F5F9',
  mutedForeground: '#64748B',
  accent: '#0891B2',
} as const;

export const colors = {
  // Theme palettes
  obsidian,
  porcelain,
  themes,
  accountCards,
  accountCardShades,
  onCard,
  categoryPalette,

  // Default theme tokens (Porcelain / Light for legacy tests)
  background: porcelain.background,
  surface: porcelain.card,
  text: porcelain.cardForeground,
  muted: porcelain.mutedForeground,
  border: porcelain.border,
  borderSubtle: porcelain.borderSubtle,
  input: porcelain.input,
  primary: porcelain.primary,
  primaryForeground: porcelain.primaryForeground,
  destructive: porcelain.destructive,

  // Backward compatibility aliases for existing components
  accent: '#15803D', // money green (ensures AA ≥ 4.5:1 on white and backward compat)
  accentSoft: '#DCFCE7',
  danger: '#B91C1C', // red-700 (ensures AA ≥ 4.5:1 on dangerSoft)
  dangerSoft: '#FEE2E2',
  warning: '#B45309', // amber-700 (ensures AA ≥ 4.5:1 on warningSoft)
  warningSoft: '#FEF3C7',
  scrim: 'rgba(0,0,0,0.6)',
  onAccent: '#FFFFFF',
  fill: porcelain.input,
  fillStrong: porcelain.border,
  separator: porcelain.borderSubtle,
} as const;