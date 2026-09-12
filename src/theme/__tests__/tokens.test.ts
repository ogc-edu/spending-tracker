/**
 * Plan 016 — accessibility token assertions:
 *  - WCAG AA contrast (≥4.5:1) for every text-on-background pair the theme
 *    ships; the plan darkened accent/danger/warning so ALL pairs pass
 *    (computed values recorded in colors.ts).
 *  - MIN_TOUCH_TARGET ≥ 44pt (WCAG 2.5.5 / HIG), the constant every
 *    interactive element builds on.
 *  - moneyFontVariant: the Platform gate in typography.ts. Under the
 *    jest-expo default (ios) preset this must be ['tabular-nums'] — this
 *    test pins that the suite exercises the ios preset (plan 016: "exercise
 *    jest-expo with the ios preset").
 */
import { describe, expect, it } from '@jest/globals';
import { colors, MIN_TOUCH_TARGET, moneyFontVariant, spacing, typography } from '@/theme';

/** WCAG relative luminance of a #RRGGBB color. */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(value.slice(i, i + 2), 16) / 255);
  const channel = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colors (≥4.5 passes AA for normal text). */
function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

describe('theme tokens', () => {
  it('exports all chrome colors', () => {
    const required = ['background', 'surface', 'text', 'muted', 'border', 'accent', 'danger', 'warning'] as const;
    for (const key of required) {
      expect(colors[key]).toBeDefined();
    }
  });

  it('has 12 category palette entries', () => {
    expect(colors.categoryPalette).toHaveLength(12);
  });

  it('uses a 4-point spacing scale', () => {
    expect(spacing.xs).toBe(4);
    expect(spacing.xxl).toBe(32);
  });

  it('defines display sizes', () => {
    expect(typeof typography.title).toBe('number');
    expect(typeof typography.money).toBe('number');
  });
});

describe('plan 016 — contrast (WCAG AA ≥ 4.5:1 for every text pair)', () => {
  it.each([
    [colors.text, colors.background],
    [colors.text, colors.surface],
    [colors.muted, colors.background],
    [colors.muted, colors.surface],
    [colors.accent, colors.surface],
    [colors.accent, colors.accentSoft],
    [colors.surface, colors.accent], // white label on an accent button
    [colors.danger, colors.surface],
    [colors.danger, colors.dangerSoft],
    [colors.warning, colors.surface],
    [colors.warning, colors.warningSoft],
  ])('%s on %s ≥ 4.5:1', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('plan 016 — touch targets', () => {
  it('MIN_TOUCH_TARGET is ≥ 44pt', () => {
    expect(MIN_TOUCH_TARGET).toBeGreaterThanOrEqual(44);
  });
});

describe('plan 016 — Platform-gated money figures typography', () => {
  it('runs under the jest-expo ios preset and enables tabular-nums there', () => {
    // jest-expo's default preset executes with Platform.OS === 'ios' — the
    // gate in typography.ts must resolve to tabular figures on that preset.
    expect(moneyFontVariant).toEqual(['tabular-nums']);
  });
});