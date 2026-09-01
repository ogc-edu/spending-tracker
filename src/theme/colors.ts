/**
 * Design tokens — single light theme (dark mode is future).
 * Palette: clean finance look, money-green accent, red for over-budget/deficit.
 */
export const colors = {
  background: '#F7F8FA',
  surface: '#FFFFFF',
  text: '#1A1D21',
  muted: '#6B7280',
  border: '#E5E7EB',
  accent: '#16A34A', // money green
  accentSoft: '#DCFCE7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  /** 12 category colors, index-aligned with the default category seed order */
  categoryPalette: [
    '#16A34A', '#0EA5E9', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899',
    '#64748B', '#10B981', '#F97316', '#3B82F6', '#A855F7', '#78716C',
  ],
} as const;