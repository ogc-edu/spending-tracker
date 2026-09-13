/**
 * Design tokens — single light theme (dark mode is future).
 * Palette: clean finance look, money-green accent, red for over-budget/deficit.
 *
 * Contrast (plan 016 a11y pass — every text pair meets WCAG AA ≥ 4.5:1,
 * asserted in src/theme/__tests__/tokens.test.ts):
 *   text      #1A1D21 on background/surface  ~16:1
 *   muted     #6B7280 on background/surface  ~4.6:1
 *   accent    #15803D on white / accentSoft  ~5.0:1 (white on accent ~5.0:1)
 *   danger    #B91C1C on white / dangerSoft  ~5.3:1+
 *   warning   #B45309 on white / warningSoft ≥4.5:1
 */
export const colors = {
  background: '#F7F8FA',
  surface: '#FFFFFF',
  text: '#1A1D21',
  muted: '#6B7280',
  border: '#E5E7EB',
  accent: '#15803D', // money green (darkened from #16A34A for AA on white/soft)
  accentSoft: '#DCFCE7',
  danger: '#B91C1C', // red-700 (darkened from #DC2626 for AA on dangerSoft)
  dangerSoft: '#FEE2E2',
  warning: '#B45309', // amber-700 (darkened from #D97706 for AA)
  warningSoft: '#FEF3C7',
  /** Plan 018: one scrim for every modal sheet (was rgba(0,0,0,.4/.45) literals). */
  scrim: 'rgba(15,23,42,0.45)',
  /** Plan 018: text/icons on accent or danger fills (reads as surface today). */
  onAccent: '#FFFFFF',
  /** 12 category colors, index-aligned with the default category seed order */
  categoryPalette: [
    '#16A34A', '#0EA5E9', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899',
    '#64748B', '#10B981', '#F97316', '#3B82F6', '#A855F7', '#78716C',
  ],
} as const;