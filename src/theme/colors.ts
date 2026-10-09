/**
 * Design tokens for Obsidian Luxe (dark) & Swiss Porcelain (light).
 *
 * Obsidian Palette (Dark / OLED-optimized):
 *   background: #090B10 — Canvas foundation establishing maximum OLED contrast
 *   card:       #121620 — Primary Bento Grid tile surface
 *   cardForeground: #F8FAFC — High-contrast text and numerical values
 *   border:     #21293A — Structural hairline framing (0.5 pt equivalent)
 *   borderSubtle: #18202F — Internal dividers between related metrics
 *   input:      #1D2433 — Background surface for text entry and keypad targets
 *   primary:    #10B981 — Electric Mint; indicates healthy cash flow and positive balances
 *   primaryForeground: #022C22 — Contrast text for primary buttons and chips
 *   destructive: #F43F5E — Vivid Rose; highlights deficits and budget overruns
 *   warning:    #F59E0B — Warm Amber; denotes approaching bills and budget limits
 *   muted:      #1A2130 — Recessed backgrounds for chips and meter tracks
 *   mutedForeground: #7C8BA1 — Secondary labels and timestamp indicators
 *   accent:     #06B6D4 — Cyber Cyan; marks linked commitments and AI evaluations
 *
 * Porcelain Palette (Light):
 *   background: #F8FAFC — Canvas foundation establishing crisp contrast
 *   card:       #FFFFFF — Primary Bento Grid tile surface
 *   cardForeground: #0F172A — High-contrast text and numerical values
 *   border:     #E2E8F0 — Structural hairline framing (0.5 pt equivalent)
 *   borderSubtle: #F1F5F9 — Internal dividers between related metrics
 *   input:      #F1F5F9 — Background surface for text entry and keypad targets
 *   primary:    #059669 — Electric Mint; healthy cash flow
 *   primaryForeground: #FFFFFF — Contrast text
 *   destructive: #E11D48 — Vivid Rose; deficits and overruns
 *   warning:    #D97706 — Warm Amber; approaching bills
 *   muted:      #F1F5F9 — Recessed backgrounds
 *   mutedForeground: #64748B — Secondary labels and timestamp indicators
 *   accent:     #0891B2 — Cyber Cyan; linked commitments and AI
 */

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

  // Default theme tokens (Porcelain / Light)
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
  scrim: 'rgba(15,23,42,0.45)',
  onAccent: '#FFFFFF',

  // Category palette (12 distinct categories)
  categoryPalette: [
    '#16A34A', '#0EA5E9', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899',
    '#64748B', '#10B981', '#F97316', '#3B82F6', '#A855F7', '#78716C',
  ],
} as const;