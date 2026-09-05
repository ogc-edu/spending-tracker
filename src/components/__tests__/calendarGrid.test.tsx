/**
 * CalendarGrid (plan 016 follow-up) — the reusable calendar. Pins the
 * Monday-start month grid math, the day-cell render, selection/min-max
 * behavior, AND the responsiveness regression: day cells are percentage
 * width + aspectRatio 1, so the 7-column grid always fits the parent
 * (the old fixed-pixel DAY_SIZE spilled a full-page-wide grid with only a
 * few day numbers on narrow phones).
 */
import { describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { CalendarGrid, monthGrid } from '../CalendarGrid';

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

const base = { year: 2026, month: 9, onSelect: (): void => {} };

describe('monthGrid (Monday-start calendar math)', () => {
  it('anchors 2026-09-01 (a Tuesday) under Monday with one leading null', () => {
    const grid = monthGrid(2026, 9);
    expect(grid[0]).toBeNull();
    expect(grid[1]).toBe('2026-09-01');
    expect(grid[grid.indexOf('2026-09-30')]).toBe('2026-09-30');
    expect(grid.length % 7).toBe(0);
  });

  it('aligns the first of any month to its weekday column', () => {
    for (let month = 1; month <= 12; month += 1) {
      const grid = monthGrid(2026, month);
      const firstIndex = grid.indexOf(`2026-${String(month).padStart(2, '0')}-01`);
      const dow = new Date(2026, month - 1, 1).getDay();
      expect(firstIndex).toBe((dow + 6) % 7); // Monday-start offset (Sun → 6)
      expect(grid.length % 7).toBe(0);
    }
  });

  it('handles leap February (29 days) and plain February', () => {
    expect(monthGrid(2024, 2)).toContain('2024-02-29');
    expect(monthGrid(2026, 2)).not.toContain('2026-02-29');
  });

  it('pads the trailing week with nulls so the grid is whole weeks', () => {
    const grid = monthGrid(2026, 12);
    expect(grid).toContain('2026-12-31');
    expect(grid.length % 7).toBe(0);
    const trailing = grid.slice(grid.indexOf('2026-12-31') + 1);
    expect(trailing.every((cell) => cell === null)).toBe(true);
  });
});

describe('CalendarGrid render', () => {
  it('renders every day of the month as a pressable with a pickable ISO testID', async () => {
    const tree = await render(<CalendarGrid {...base} />);
    const dayCells = tree.root.findAll(
      (node) => typeof node.type === 'string' && String(node.props.testID ?? '').startsWith('calendar-day-'),
    );
    expect(dayCells).toHaveLength(30); // September 2026 has 30 days
    expect(
      tree.root.findAll(
        (node) => typeof node.type === 'string' && node.props.testID === 'calendar-day-2026-09-30',
      ),
    ).toHaveLength(1);
  });

  it('day cells are percentage-width squares (fits any screen — regression pin)', async () => {
    const tree = await render(<CalendarGrid {...base} />);
    const cell = tree.root.findByProps({ testID: 'calendar-day-2026-09-15' });
    const style = StyleSheet.flatten(
      typeof cell.props.style === 'function' ? cell.props.style({ pressed: false }) : cell.props.style,
    ) as { width: string; aspectRatio: number; minHeight: number };
    expect(style.width).toBe(`${100 / 7}%`); // one column of 7 — never wider than the parent
    expect(style.aspectRatio).toBe(1);
    expect(style.minHeight).toBeGreaterThanOrEqual(44); // touch floor
  });

  it('fires onSelect with the tapped ISO date', async () => {
    const onSelect = jest.fn();
    const tree = await render(<CalendarGrid {...base} onSelect={onSelect} />);
    const day = tree.root.findByProps({ testID: 'calendar-day-2026-09-20' });
    await act(async () => {
      (day.props as { onPress: () => void }).onPress();
    });
    expect(onSelect).toHaveBeenCalledWith('2026-09-20');
  });

  it('marks the value day selected and disables days outside min/max', async () => {
    const tree = await render(
      <CalendarGrid {...base} value="2026-09-15" minDate="2026-09-10" maxDate="2026-09-20" />,
    );
    const selected = tree.root.findByProps({ testID: 'calendar-day-2026-09-15' });
    expect(selected.props.accessibilityState?.selected).toBe(true);
    const before = tree.root.findByProps({ testID: 'calendar-day-2026-09-09' });
    const after = tree.root.findByProps({ testID: 'calendar-day-2026-09-21' });
    expect(before.props.disabled).toBe(true);
    expect(after.props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: 'calendar-day-2026-09-11' }).props.disabled).toBe(false);
  });
});