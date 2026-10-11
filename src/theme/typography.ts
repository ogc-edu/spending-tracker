/**
 * Type scale and typography system for Geist and design.jsonc spec.
 */
import { Platform, type FontVariant, type TextStyle } from 'react-native';

export const geistWeights = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semiBold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
} as const;

export interface TypeScaleEntry {
  fontSize: number;
  lineHeight: number;
  fontWeight: TextStyle['fontWeight'];
  letterSpacing?: number;
  fontFamily: string;
  textTransform?: TextStyle['textTransform'];
  activeWeight?: TextStyle['fontWeight'];
}

export const typeScale: Record<string, TypeScaleEntry> = {
  largeTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.56,
    fontFamily: geistWeights.bold,
  },
  amountHero: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '700',
    letterSpacing: -0.88,
    fontFamily: geistWeights.bold,
  },
  amountSheet: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.68,
    fontFamily: geistWeights.bold,
  },
  amountL: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.52,
    fontFamily: geistWeights.bold,
  },
  amountM: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.22,
    fontFamily: geistWeights.semiBold,
  },
  amountS: {
    fontSize: 17,
    lineHeight: 28,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  headline: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  body: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
  },
  sectionCaps: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontFamily: geistWeights.semiBold,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '500',
    activeWeight: '600',
    fontFamily: geistWeights.medium,
  },
  axis: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
  },
  tileMonth: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '600',
    letterSpacing: 0.54,
    fontFamily: geistWeights.semiBold,
  },
} as const;

export const typography = {
  header: 11, // Card titles & section headers
  caption: 12, // Metadata & captions
  body: 15,
  bodyLarge: 16, // Standard body (text-base)
  emphasis: 17,
  moneySmall: 18,
  title: 22,
  money: 28, // Headline money amounts
  display: 34, // Headline display figures
  hero: 48, // text-5xl hero numbers

  // New design scale values (font sizes)
  largeTitle: 28,
  amountHero: 44,
  amountSheet: 34,
  amountL: 26,
  amountM: 22,
  amountS: 17,
  headline: 15,
  sectionCaps: 12,
  tabLabel: 11,
  axis: 10,
  tileMonth: 9,
} as const;

/**
 * Platform-gated tabular figures for money text. iOS: ['tabular-nums'];
 * Android (Roboto tabular natively): undefined — the `fontVariant` prop
 * accepts undefined, so styles can spread `fontVariant: moneyFontVariant`
 * unconditionally.
 */
export const moneyFontVariant: FontVariant[] | undefined = Platform.select({
  ios: ['tabular-nums'],
  default: undefined,
});

/**
 * Tabular figures variant for elements strictly requiring tabular-nums across platforms.
 */
export const tabularNumsVariant: FontVariant[] = ['tabular-nums'];

/**
 * Font families mapped to Tailwind and React Native configuration.
 */
export const fontFamilies = {
  mono: ['SpaceMono', 'Courier New', 'monospace'],
  sans: ['Inter', 'system-ui', 'sans-serif'],
  geist: geistWeights,
} as const;

/**
 * Standard utility class strings for typography hierarchy.
 */
export const typographyClasses = {
  heroNumber: 'text-5xl font-black font-mono tracking-tighter tabular-nums',
  cardTitle: 'text-[11px] font-bold uppercase tracking-wider text-muted-foreground',
  sectionHeader: 'text-[11px] font-bold uppercase tracking-wider text-muted-foreground',
  body: 'text-base font-semibold text-foreground',
  caption: 'text-xs font-medium text-muted-foreground',
} as const;