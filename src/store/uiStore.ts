/**
 * uiStore (plan 005, EXP-8 fast entry / ARCHITECTURE §2, §5) — Zustand,
 * NON-persistent UI state only: the last-used category/account, which the
 * "New expense" form prefills (date defaults to today). SQLite stays the
 * single source of truth; nothing financial is ever cached here.
 */
import { create } from 'zustand';

interface UiState {
  lastUsedCategoryId: number | null;
  lastUsedAccountId: number | null;
  /** Record after a successful expense create/edit (plan 005 fast entry). */
  setLastUsed(categoryId: number, accountId: number): void;
}

export const useUiStore = create<UiState>((set) => ({
  lastUsedCategoryId: null,
  lastUsedAccountId: null,
  setLastUsed: (categoryId, accountId) =>
    set({ lastUsedCategoryId: categoryId, lastUsedAccountId: accountId }),
}));