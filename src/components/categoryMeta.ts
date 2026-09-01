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