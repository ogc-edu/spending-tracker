/**
 * Type scale. Financial figures should render with tabular figures
 * (adjust the fontVariant on numeric Text) so digits don't jiggle.
 */
export const typography = {
  caption: 12,
  body: 15,
  emphasis: 17,
  title: 22,
  money: 28, // headline money amounts
  moneySmall: 18,
} as const;