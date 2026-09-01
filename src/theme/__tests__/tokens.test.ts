import { describe, expect, it } from '@jest/globals';
import { colors, spacing, typography } from '@/theme';

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