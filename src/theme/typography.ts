/**
 * Type scale and typography system.
 *
 * Redesign typography scale specifications:
 * - Display / Hero Numbers: `text-5xl font-black font-mono tracking-tighter` with `fontVariant: ['tabular-nums']`
 * - Card Titles & Section Headers: `text-[11px] font-bold uppercase tracking-wider text-muted-foreground`
 * - Standard Body: `text-base font-semibold text-foreground`
 * - Metadata & Captions: `text-xs font-medium text-muted-foreground`
 * - Tabular Figures: All currency and numerical metrics must specify tabular numbers to prevent layout shift during updates.
 */
import { Platform, type FontVariant } from 'react-native';

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