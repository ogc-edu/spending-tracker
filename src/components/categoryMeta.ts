/**
 * Category display meta (plan 005 UI) — palette lookup shared by the expense
 * form chips and the expenses list dots. The 12-color palette is
 * index-aligned with the default category seed order (ids 1..12); ids beyond
 * the palette wrap around.
 */
import { colors } from '@/theme';

export function categoryColor(categoryId: number): string {
  return colors.categoryPalette[(categoryId - 1) % colors.categoryPalette.length] ?? colors.accent;
}

/**
 * Curated Ionicons for custom categories (the "+" add-chip sheet picker).
 * Reuses the seed set plus a few common ones; name-cased-matchable so the
 * picker grid stays deterministic for tests.
 */
export const CATEGORY_ICON_CHOICES = [
  'restaurant-outline',
  'cart-outline',
  'car-outline',
  'film-outline',
  'bag-handle-outline',
  'receipt-outline',
  'medkit-outline',
  'school-outline',
  'airplane-outline',
  'gift-outline',
  'card-outline',
  'briefcase-outline',
  'flash-outline',
  'home-outline',
  'game-controller-outline',
  'phone-portrait-outline',
  'fitness-outline',
  'ellipsis-horizontal-circle-outline',
] as const;