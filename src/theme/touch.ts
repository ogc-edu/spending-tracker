/**
 * Accessibility touch-target constants (plan 016 / PRD NFR-8, a11y pass).
 *
 * WCAG 2.5.5 / Apple HIG minimum interactive size: 44×44 pt. Screens apply
 * `minHeight`/`minWidth` (or hitSlop padding) to every interactive element;
 * tokens.test.ts asserts the constant and key components assert it via
 * their styles.
 */
export const MIN_TOUCH_TARGET = 44;

/** Ready-to-spread style: the minimum hit area for a Pressable. */
export const touchTarget = {
  minWidth: MIN_TOUCH_TARGET,
  minHeight: MIN_TOUCH_TARGET,
} as const;