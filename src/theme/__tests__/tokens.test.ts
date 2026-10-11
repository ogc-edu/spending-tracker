/**
 * Theme & design token assertions:
 *  - WCAG AA contrast (≥4.5:1) for Obsidian Luxe, Swiss Porcelain, Dark and Light themes.
 *  - Backward-compatible contrast assertions for chrome colors.
 *  - MIN_TOUCH_TARGET ≥ 44pt (WCAG 2.5.5 / Apple HIG).
 *  - Platform-gated tabular figures and typography scale.
 */
import { describe, expect, it } from '@jest/globals';
import {
  accountCards,
  categoryPalette,
  colors,
  fontFamilies,
  MIN_TOUCH_TARGET,
  moneyFontVariant,
  obsidian,
  onCard,
  porcelain,
  spacing,
  tabularNumsVariant,
  themes,
  typeScale,
  typography,
  typographyClasses,
} from '@/theme';

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

  it('exports Obsidian Luxe and Swiss Porcelain palettes', () => {
    const requiredKeys = [
      'background',
      'card',
      'cardForeground',
      'border',
      'borderSubtle',
      'input',
      'primary',
      'primaryForeground',
      'destructive',
      'warning',
      'muted',
      'mutedForeground',
      'accent',
    ] as const;

    for (const key of requiredKeys) {
      expect(obsidian[key]).toBeDefined();
      expect(porcelain[key]).toBeDefined();
    }

    expect(obsidian.background).toBe('#090B10');
    expect(obsidian.primary).toBe('#10B981');
    expect(porcelain.background).toBe('#F8FAFC');
    expect(porcelain.card).toBe('#FFFFFF');
  });

  it('exports dual theme tokens matching design.jsonc', () => {
    const tokenKeys = [
      'bg',
      'tabbar',
      'surface',
      'fill',
      'fillStrong',
      'sheet',
      'separator',
      'separatorStrong',
      'chipBorder',
      'track',
      'handle',
      'scrim',
      'text',
      'textSecondary',
      'textTertiary',
      'accent',
      'onAccent',
      'emphasis',
      'link',
      'selectedBg',
      'switchOff',
      'segmentTrack',
      'segmentThumb',
      'chartActive',
      'chartMax',
      'chartIdle',
      'barMuted',
      'danger',
      'cardShadow',
    ] as const;

    for (const k of tokenKeys) {
      expect(themes.dark[k]).toBeDefined();
      expect(themes.light[k]).toBeDefined();
    }

    expect(themes.dark.bg).toBe('#000000');
    expect(themes.dark.accent).toBe('#F5B83D');
    expect(themes.light.bg).toBe('#F2F2F2');
    expect(themes.light.accent).toBe('#111111');
  });

  it('exports accountCards and onCard palettes', () => {
    expect(accountCards.bank.dark).toBe('#24408F');
    expect(accountCards.cash.dark).toBe('#0E6B63');
    expect(accountCards.ewallet.dark).toBe('#5A3E9E');
    expect(accountCards.credit_card.dark).toBe('#3A3A3C');
    expect(accountCards.credit_card.light).toBe('#1F1F21');
    expect(accountCards.paylater.dark).toBe('#B8430F');

    expect(onCard.text).toBe('#FFFFFF');
    expect(onCard.payButton.bg).toBe('#FFFFFF');
    expect(onCard.payButton.text).toBe('#7A2A07');
  });

  it('has 12 category palette entries aligned with seed', () => {
    expect(categoryPalette).toHaveLength(12);
    expect(categoryPalette[0].seed).toBe('Food');
    expect(categoryPalette[0].darkFg).toBe('#F5B83D');
    expect(categoryPalette[11].seed).toBe('Other');
  });

  it('uses a 4-point spacing scale and design spacing tokens', () => {
    expect(spacing.xs).toBe(4);
    expect(spacing.xxl).toBe(32);
    expect(spacing.screenX).toBe(16);
    expect(spacing.sectionGap).toBe(20);
  });

  it('defines typography scale and display sizes', () => {
    expect(typeof typography.title).toBe('number');
    expect(typeof typography.money).toBe('number');
    expect(typeof typography.hero).toBe('number');
    expect(typeof typography.header).toBe('number');
    expect(typography.hero).toBe(48);
    expect(typography.header).toBe(11);
    expect(typography.largeTitle).toBe(28);
    expect(typography.amountHero).toBe(44);
    expect(typeScale.largeTitle.fontSize).toBe(28);
    expect(typeScale.largeTitle.lineHeight).toBe(34);
  });

  it('exports font families and typography class presets', () => {
    expect(fontFamilies.mono).toContain('SpaceMono');
    expect(fontFamilies.sans).toContain('Inter');
    expect(typographyClasses.heroNumber).toContain('tabular-nums');
    expect(typographyClasses.heroNumber).toContain('font-mono');
    expect(tabularNumsVariant).toEqual(['tabular-nums']);
  });
});

describe('Wave 1A — Dark theme contrast (WCAG AA ≥ 4.5:1)', () => {
  it.each([
    [themes.dark.text, themes.dark.bg],
    [themes.dark.text, themes.dark.surface],
    [themes.dark.textSecondary, themes.dark.bg],
    [themes.dark.textSecondary, themes.dark.surface],
    [themes.dark.accent, themes.dark.bg],
    [themes.dark.onAccent, themes.dark.accent],
    [themes.dark.danger, themes.dark.bg],
  ])('%s on %s ≥ 4.5:1', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Wave 1A — Light theme contrast (WCAG AA ≥ 4.5:1)', () => {
  it.each([
    [themes.light.text, themes.light.bg],
    [themes.light.text, themes.light.surface],
    [themes.light.textSecondary, themes.light.bg],
    [themes.light.textSecondary, themes.light.surface],
    [themes.light.textTertiary, themes.light.bg],
    [themes.light.onAccent, themes.light.accent],
    [themes.light.danger, themes.light.surface],
  ])('%s on %s ≥ 4.5:1', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Wave 1A — onCard contrast (WCAG AA ≥ 4.5:1)', () => {
  it.each([
    [onCard.text, accountCards.bank.dark],
    [onCard.text, accountCards.cash.dark],
    [onCard.text, accountCards.ewallet.dark],
    [onCard.text, accountCards.credit_card.dark],
    [onCard.text, accountCards.credit_card.light],
    [onCard.text, accountCards.paylater.dark],
    [onCard.payButton.text, onCard.payButton.bg],
  ])('%s on %s ≥ 4.5:1', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('plan 001 — Obsidian Luxe contrast (WCAG AA ≥ 4.5:1)', () => {
  it.each([
    [obsidian.cardForeground, obsidian.background],
    [obsidian.cardForeground, obsidian.card],
    [obsidian.mutedForeground, obsidian.background],
    [obsidian.mutedForeground, obsidian.card],
    [obsidian.primary, obsidian.background],
    [obsidian.primaryForeground, obsidian.primary],
    [obsidian.destructive, obsidian.background],
    [obsidian.warning, obsidian.background],
    [obsidian.accent, obsidian.background],
  ])('%s on %s ≥ 4.5:1', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('plan 001 — Swiss Porcelain contrast (WCAG AA ≥ 4.5:1)', () => {
  it.each([
    [porcelain.cardForeground, porcelain.background],
    [porcelain.cardForeground, porcelain.card],
    [porcelain.mutedForeground, porcelain.background],
    [porcelain.mutedForeground, porcelain.card],
    [porcelain.destructive, porcelain.card],
  ])('%s on %s ≥ 4.5:1', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('plan 016 — backward compatibility contrast (WCAG AA ≥ 4.5:1)', () => {
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