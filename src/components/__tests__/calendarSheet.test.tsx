/**
 * CalendarSheet (plan 016 follow-up) — the commitment date picker.
 * Pins the Monday-start month grid (pure `monthGrid`), the sheet's
 * render/navigate/select behavior, min/max disabling, and ≥44pt touch
 * targets on month arrows and day cells.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { CalendarSheet, monthGrid } from '../CalendarSheet';

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

function textOf(root: ReactTestInstance, testID: string): string {
  const el = root.findByProps({ testID });
  const texts: string[] = [];
  const collect = (node: ReactTestInstance): void => {
    for (const child of node.children) {
      if (typeof child === 'string') texts.push(child);
      else collect(child);
    }
  };
  collect(el);
  return texts.join('');
}

async function press(tree: ReactTestRenderer, testID: string): Promise<void> {
  const el = tree.root.findByProps({ testID });
  await act(async () => {
    (el.props as { onPress: () => void }).onPress();
  });
}

/** Flatten a Pressable style — FUNCTION (renderer sees the function) or plain array/object. */
function flattenedStyle(node: ReactTestInstance): { minHeight: number; minWidth: number; height: number; width: number } {
  const style = node.props.style as
    | ((state: { pressed: boolean }) => unknown)
    | Record<string, unknown>
    | Record<string, unknown>[];
  const resolved = typeof style === 'function' ? style({ pressed: false }) : style;
  return StyleSheet.flatten(resolved) as {
    minHeight: number;
    minWidth: number;
    height: number;
    width: number;
  };
}

const baseProps = {
  title: 'Select start date',
  value: '2026-09-15',
  onSelect: (): void => {},
  onCancel: (): void => {},
};

describe('monthGrid (Monday-start calendar math)', () => {
  it('anchors 2026-09-01 (a Tuesday) under Monday with one leading null', () => {
    // 2026-09-01 is a Tuesday → Monday-start grid: [null, '2026-09-01', …]
    const grid = monthGrid(2026, 9);
    expect(grid[0]).toBeNull();
    expect(grid[1]).toBe('2026-09-01');
    expect(grid[grid.indexOf('2026-09-30')]).toBe('2026-09-30');
    expect(grid.length % 7).toBe(0);
  });

  it('aligns the first of any month to its weekday column', () => {
    const year = 2026;
    for (let month = 1; month <= 12; month += 1) {
      const grid = monthGrid(year, month);
      const firstIndex = grid.indexOf(`${year}-${String(month).padStart(2, '0')}-01`);
      const dow = new Date(year, month - 1, 1).getDay();
      expect(firstIndex).toBe((dow + 6) % 7); // Monday-start offset (Sun → 6)
      expect(grid.length % 7).toBe(0);
    }
  });

  it('handles leap February (29 days) and plain February', () => {
    expect(monthGrid(2024, 2)).toContain('2024-02-29');
    expect(monthGrid(2026, 2)).not.toContain('2026-02-29');
  });

  it('pads the trailing week with nulls so the grid is whole weeks', () => {
    // December 2026 ends on a Thursday → 2 trailing nulls.
    const grid = monthGrid(2026, 12);
    expect(grid).toContain('2026-12-31');
    expect(grid.length % 7).toBe(0);
    const trailing = grid.slice(grid.indexOf('2026-12-31') + 1);
    expect(trailing.every((cell) => cell === null)).toBe(true);
  });
});

describe('CalendarSheet', () => {
  it('renders nothing while hidden, then the title/month/weekdays when visible', async () => {
    const hidden = await render(<CalendarSheet visible={false} {...baseProps} />);
    expect(hidden.root.findAllByProps({ testID: 'calendar-sheet' })).toHaveLength(0);

    const shown = await render(<CalendarSheet visible {...baseProps} />);
    expect(textOf(shown.root, 'calendar-sheet-title')).toBe('Select start date');
    expect(textOf(shown.root, 'calendar-month-label')).toBe('September 2026');
    for (const label of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect(shown.root.findAllByProps({ children: label }).length).toBeGreaterThan(0);
    }
  });

  it('calls onSelect with the picked ISO date and shows the selected day highlighted', async () => {
    const onSelect = jest.fn();
    const onCancel = jest.fn();
    const tree = await render(<CalendarSheet visible {...baseProps} onSelect={onSelect} onCancel={onCancel} />);

    const selected = tree.root.findByProps({ testID: 'calendar-day-2026-09-15' });
    expect(selected.props.accessibilityState?.selected).toBe(true);

    await press(tree, 'calendar-day-2026-09-20');
    expect(onSelect).toHaveBeenCalledWith('2026-09-20');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('navigates months with the chevron arrows', async () => {
    const tree = await render(<CalendarSheet visible {...baseProps} />);
    await press(tree, 'calendar-prev-month');
    expect(textOf(tree.root, 'calendar-month-label')).toBe('August 2026');
    await press(tree, 'calendar-next-month');
    await press(tree, 'calendar-next-month');
    expect(textOf(tree.root, 'calendar-month-label')).toBe('October 2026');
  });

  it('disables days before minDate and after maxDate, keeping the rest enabled', async () => {
    const tree = await render(
      <CalendarSheet visible {...baseProps} minDate="2026-09-10" maxDate="2026-09-20" />,
    );
    const before = tree.root.findByProps({ testID: 'calendar-day-2026-09-09' });
    const after = tree.root.findByProps({ testID: 'calendar-day-2026-09-21' });
    const inside = tree.root.findByProps({ testID: 'calendar-day-2026-09-11' });
    expect(before.props.disabled).toBe(true);
    expect(after.props.disabled).toBe(true);
    expect(inside.props.disabled).toBe(false);
  });

  it('closes via the scrim and the Cancel button (onCancel, never onSelect)', async () => {
    const onSelect = jest.fn();
    const onCancel = jest.fn();
    const tree = await render(<CalendarSheet visible {...baseProps} onSelect={onSelect} onCancel={onCancel} />);
    await press(tree, 'calendar-cancel');
    expect(onCancel).toHaveBeenCalledTimes(1);
    await press(tree, 'calendar-sheet-close');
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps ≥44pt touch targets on month arrows and day cells', async () => {
    const tree = await render(<CalendarSheet visible {...baseProps} />);
    const smallest = (node: ReactTestInstance): number => {
      const style = flattenedStyle(node);
      const vertical = style.minHeight ?? style.height ?? Infinity;
      const horizontal = style.minWidth ?? style.width ?? Infinity;
      return Math.min(vertical, horizontal);
    };
    for (const testID of ['calendar-prev-month', 'calendar-next-month', 'calendar-sheet-close', 'calendar-cancel']) {
      expect(smallest(tree.root.findByProps({ testID }))).toBeGreaterThanOrEqual(44);
    }
    expect(smallest(tree.root.findByProps({ testID: 'calendar-day-2026-09-01' }))).toBeGreaterThanOrEqual(44);
  });
});