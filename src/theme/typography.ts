/**
 * Type scale. Financial figures render with tabular figures on iOS via
 * `moneyFontVariant` (SF Pro's digits are proportional — the fontFeature
 * keeps digits from jiggling). Android's system font (Roboto) has
 * uniform-width digits natively, so no feature flag is needed there —
 * the Platform gate in `moneyFontVariant` reflects exactly that (plan 016,
 * iOS parity pass). Apply it to any `Text` that renders formatSen() output.
 */
import { Platform, type FontVariant } from 'react-native';

export const typography = {
  caption: 12,
  body: 15,
  emphasis: 17,
  title: 22,
  display: 34, // the two headline money figures (hero, analytics total)
  money: 28, // headline money amounts
  moneySmall: 18,
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