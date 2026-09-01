/**
 * uiStore (plan 005 EXP-8 fast entry + plan 006 filter state / ARCHITECTURE
 * §2, §5) — Zustand, NON-persistent UI state only. Plan 005: the last-used
 * category/account prefills the "New expense" form. Plan 006: the expense
 * history filter (search/category/period/custom range/offset) lives here so
 * returning from the detail/edit screens keeps context. SQLite stays the
 * single source of truth; nothing financial is ever cached here.
 *
 * Offset discipline (plan 006 §Edge cases): EVERY filter-changing setter
 * resets offset to 0 — pagination always restarts from the top of the
 * filtered set. Only setExpenseOffset moves it (FlatList onEndReached).
 */
import { create } from 'zustand';
import type { PeriodPreset } from '@/utils/dates';

/** Default view = current month (matches the dashboard); one tap clears to All (plan 006). */
const DEFAULT_PERIOD: PeriodPreset = 'thisMonth';

/** Selected calendar month for month-scoped tabs (Budgets 007, Analytics 011) — ARCH §5. */
export interface MonthSelection {
  /** 1–12. */
  month: number;
  year: number;
}

/** Default selection follows the device calendar (plan 007 — rollover shows fresh months). */
function currentMonthSelection(): MonthSelection {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export interface ExpenseFilterState {
  /** Raw search text; applied after 300 ms debounce. */
  search: string;
  /** Single-select category filter (F1) — null = All. */
  categoryId: number | null;
  period: PeriodPreset;
  /** Custom range (period === 'custom'); '' until an Apply is accepted. */
  customFrom: string;
  customTo: string;
  /** Pagination offset into the filtered set; 0 on any filter change. */
  offset: number;
}

interface UiState {
  lastUsedCategoryId: number | null;
  lastUsedAccountId: number | null;
  expenseFilter: ExpenseFilterState;
  /** Month-scoped tabs (Budgets, Analytics) share this selection — plan 007 §UI. */
  selectedMonth: MonthSelection;
  /** Record after a successful expense create/edit (plan 005 fast entry). */
  setLastUsed(categoryId: number, accountId: number): void;
  /** Debounced search text lands here; resets offset. */
  setExpenseSearch(search: string): void;
  /** null clears the category chip (tap active chip = All, F1). Resets offset. */
  setExpenseCategory(categoryId: number | null): void;
  /** Switches the period preset; resets offset. */
  setExpensePeriod(period: PeriodPreset): void;
  /** Accepted custom range (both dates valid, from ≤ to). Resets offset. */
  setExpenseCustomRange(from: string, to: string): void;
  /** FlatList onEndReached — the ONLY setter that preserves/paginates offset. */
  setExpenseOffset(offset: number): void;
  /** Move the shared month selection (Budgets/Analytics). */
  setSelectedMonth(month: MonthSelection): void;
  /** Record the account after a commitment payment (plan 008 mark-paid prefill). */
  setLastUsedAccount(accountId: number | null): void;
}

export const useUiStore = create<UiState>((set) => ({
  lastUsedCategoryId: null,
  lastUsedAccountId: null,
  expenseFilter: {
    search: '',
    categoryId: null,
    period: DEFAULT_PERIOD,
    customFrom: '',
    customTo: '',
    offset: 0,
  },
  selectedMonth: currentMonthSelection(),
  setLastUsed: (categoryId, accountId) =>
    set({ lastUsedCategoryId: categoryId, lastUsedAccountId: accountId }),
  setExpenseSearch: (search) =>
    set((s) => ({ expenseFilter: { ...s.expenseFilter, search, offset: 0 } })),
  setExpenseCategory: (categoryId) =>
    set((s) => ({ expenseFilter: { ...s.expenseFilter, categoryId, offset: 0 } })),
  setExpensePeriod: (period) =>
    set((s) => ({ expenseFilter: { ...s.expenseFilter, period, offset: 0 } })),
  setExpenseCustomRange: (customFrom, customTo) =>
    set((s) => ({ expenseFilter: { ...s.expenseFilter, customFrom, customTo, period: 'custom', offset: 0 } })),
  setExpenseOffset: (offset) =>
    set((s) => ({ expenseFilter: { ...s.expenseFilter, offset } })),
  setSelectedMonth: (selectedMonth) => set({ selectedMonth }),
  setLastUsedAccount: (accountId) => set({ lastUsedAccountId: accountId }),
}));