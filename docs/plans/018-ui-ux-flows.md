# Plan 018 — UI/UX Flows & Density

Second pass after 017. 017 fixed **chrome** (shared Card/Chip/Badge/Fab,
hero hierarchy, 44-pt filter chips, tab-label truncation). This plan fixes
**how the app is used**: navigation density, dead dashboard surfaces, forms
that 017 skipped, list noise, sheets, loading, and the remaining token
violations.

Visual + interaction. **No financial math, no SQL, no new native modules.**
Every existing testID, accessibility label, and screen contract stays unless
this plan names the exception. Card order on the dashboard (plan 010) stays.

Reanimated 4.5 and gesture-handler are already in the APK — motion is in
scope. `expo-haptics` is **out** (new native dep). Dark mode is **out**.

---

## 0. What 017 left behind

| # | Finding | Why it still hurts |
|---|---------|-------------------|
| B1 | **Six tabs.** Labels no longer truncate, but six equal destinations is still a phone anti-pattern — Settings is not a daily surface. | Tab bar remains crowded; Settings competes with Expenses. |
| B2 | **Dashboard is read-only.** Upcoming rows and category rows do not navigate. The most common write (add expense) is hidden on another tab's FAB. | The "heart of the product" is a report, not a workspace. |
| B3 | **Lists are stacks of mini-cards.** ExpenseRow, commitment rows, AccountRow, BudgetRow each carry their own border+radius+shadow. | Visual noise; hard to scan 20 expenses. |
| B4 | **No date grouping on Expenses.** Every row is independent. | Phone expense apps group Today / Yesterday / date. |
| B5 | **Forms were skipped.** ExpenseForm / CommitmentForm / AccountForm / BudgetForm still roll their own chips, `#fff` labels, `radius.sm` buttons. | Add-expense is the highest-frequency screen and still looks like 016. |
| B6 | **Sheets are five different bottom-modals.** ConfirmSheet, CalendarSheet, PaymentFlowSheet, AccountBalanceSheet, PayrollAllocationSheet, CategoryAddSheet, BudgetForm modal — different radii, no grab handle, inconsistent padding. | Feels like several apps glued together. |
| B7 | **Bare spinners.** Every tab's loading state is a lone `ActivityIndicator`. Pull-to-refresh exists only on Dashboard. | First paint and tab switches feel unfinished. |
| B8 | **Settings is a kitchen sink.** Accounts + payroll + buffer + categories + AI + logout in one scroll. | The AI section is a long way down (we felt this driving adb). |
| B9 | **`Card` is half-adopted.** BudgetCard, analytics total/breakdown, StatGrid, settings cards, expense/commitment rows still copy-paste surfaces. HeroCard still uses literal `#0F172A`. Forms still use `#fff`. | Token rule + 017's own primitive unused. |
| B10 | **Toast is error-only** (except payroll-in). Saving an expense/budget/commitment gives no confirmation. | User is not sure the write landed until they re-read the list. |
| B11 | **Detail screens don't match the new language.** Expense detail is a sparse white card; commitment detail mixes schedule + destructive actions without a hero. | Hierarchy 017 established on Dashboard doesn't travel. |
| B12 | **"Recurring" tab vs "Commitments" header.** Short label fixed truncation but introduced a naming split. | Mild confusion; either commit to Recurring everywhere in chrome, or drop Settings from the tab bar so "Commitments" fits. |

---

## 1. Design decisions (this pass)

1. **Five tabs, Settings as a header gear.** Destinations people visit daily:
   Home · Expenses · Budgets · Commitments · Analytics. Settings moves to a
   44-pt gear on the Dashboard header (and a matching gear on the other tab
   headers is *not* required — one obvious door is enough). Header title of
   the commitments tab stays **"Commitments"**; the short tab label can
   revert from "Recurring" to **"Bills"** *or* stay "Commitments" now that
   there are five slots. **Pick: tab label `Commitments` (5 tabs, it fits).**
2. **Dashboard rows are links.** Upcoming item → `/commitments/[id]`.
   Category row → Expenses with that `categoryId` set in `uiStore` (existing
   filter). A Dashboard FAB (shared `Fab`) → `/expenses/new`. The 010 card
   *order* does not change.
3. **Lists, not card-stacks.** Expense / commitment / account / budget rows
   sit inside one `Card` (or a flush grouped list with separators), not one
   bordered card per row. Date-section headers on Expenses.
4. **One `Sheet` primitive.** Grab handle, `radius.xxl` top corners, shared
   scrim token, 16/24 padding, keyboard-aware. Every modal bottom-sheet
   composes it.
5. **One `Button` primitive.** `primary` / `secondary` / `danger` / `ghost`,
   minHeight 48, no `#fff`. Forms, sheets, logout all use it.
6. **Forms use `Chip`.** Expense/commitment/account/budget pickers stop
   rolling their own chip styles. Amount stays the visual primary (already
   taller via MoneyInput).
7. **Success toasts** for writes that currently go silent (expense save,
   budget upsert, commitment create, mark-paid). Keep AI errors inline.
8. **Loading skeletons** that match the destination layout (hero + two
   cards), not a centered spinner. Pull-to-refresh on Expenses / Budgets /
   Analytics / Commitments too.
9. **Motion, existing deps only.** Reanimated `FadeIn`/`Layout` on list
   inserts and formula expand; sheet already uses `animationType="slide"` —
   keep it (rewriting Modal→Gesture Handler bottom sheet is out of scope).

---

## 2. New / extended primitives (`src/components/ui/`)

| Component | API | Replaces |
|---|---|---|
| `Button` | `variant: 'primary'\|'secondary'\|'danger'\|'ghost'`, `label`, `busy?`, `icon?`, `onPress`, `testID` | Every filled/outline/danger Pressable (`#fff` labels, inconsistent radius) |
| `Sheet` | `visible`, `onClose`, `title?`, `children` | ConfirmSheet chrome, CalendarSheet chrome, PaymentFlowSheet chrome, BudgetForm modal, AccountBalanceSheet, PayrollAllocationSheet, CategoryAddSheet |
| `List` + `ListRow` | grouped surface, separator, optional leading icon circle, trailing money, chevron | ExpenseRow / commitment row / AccountRow outer chrome |
| `SectionLabel` | date or group header (`Today`, `12 Sep`) | new, Expenses grouping |
| `Skeleton` | `Hero` / `Card` / `Row` placeholders | centered ActivityIndicator on tabs |
| `IconButton` | 44-pt circular / square, for header gear, trash, eye | ad-hoc 40×40 trash buttons |

Token additions (additive — tokens test only asserts existing required keys):

- `colors.scrim = 'rgba(15,23,42,0.45)'` (one scrim, no more `rgba(0,0,0,0.45)` literals)
- `colors.onAccent = colors.surface` — kill remaining `#fff` on accent/danger buttons
- `shadows.hero` — move HeroCard's `#0F172A` / elevation 5 into the token file

Do **not** change the AA-asserted palette. New keys only.

---

## 3. Information architecture

```
Tab bar (5)
  Home        → Dashboard (+ header gear → Settings, + FAB → new expense)
  Expenses    → history (grouped by date)
  Budgets     → month budgets
  Commitments → recurring obligations
  Analytics   → month report

Stack (unchanged routes)
  /expenses/new, /expenses/[id], /expenses/[id]/edit
  /commitments/new, /commitments/[id], /commitments/[id]/edit
  /settings            ← now also reachable from Dashboard header
  /settings/ai/[provider]
```

**Exception named:** `(tabs)/_layout.tsx` loses the Settings tab. The
`settings` route stays as a Stack screen (already is, via the same file —
expo-router will hide it from the tab bar with `href: null`). Header title
"Settings" unchanged. Tests that navigate to `/settings` keep working.

No new routes. No new services.

---

## 4. Screen-by-screen

### 4.1 Tabs layout
- Five `Tabs.Screen`s. Settings: `href: null` (reachable via stack).
- Tab label font can return to 11 — five labels fit.
- Commitments tab label = `Commitments` (drop "Recurring").
- Dashboard `headerRight`: 44-pt gear → `router.push('/settings')`,
  `testID="dashboard-settings"`.

### 4.2 Dashboard
- `UpcomingList` rows become `Pressable` → `/commitments/${id}`. Keep
  testID `upcoming-card`. New per-row testID `upcoming-row-${commitmentId}`.
- `CategorySummary` rows become `Pressable` → set `uiStore.expenseFilter.categoryId`
  + `router.navigate('/expenses')`. "Show all" still goes to Analytics
  (existing testID `category-show-all`).
- Shared `Fab` on Dashboard, `label="Add expense"`, `testID="dashboard-add-expense-fab"`.
- Loading: `Skeleton` of hero + two cards instead of a spinner.
- `error && !snapshot` already uses `InlineError` — keep.

### 4.3 Expenses
- **Group by date.** `ExpenseList` inserts sticky-feeling section headers
  (`Today` / `Yesterday` / `formatDayLabel`) via `SectionList` or a
  derived `{ title, data }[]`. Key extractor and `onEndReached` pagination
  stay 50/batch — grouping is presentational over the already-fetched page
  (a date can split across pages; headers simply repeat, which is fine).
- Rows move into one grouped surface: no per-row border. Separator hairline.
  Keep `expense-row-${id}` testIDs.
- Pull-to-refresh (same `load()`).
- Loading: 6 `Skeleton.Row`s.
- FAB stays.

### 4.4 Budgets
- Month bar already pill-styled (017). Keep.
- `BudgetCard` composes `Card` (drop copy-pasted shadow).
- `BudgetRow`s sit in one grouped `Card` with separators, not 12 mini-cards.
- Pull-to-refresh. Skeleton of card + 3 rows.
- "Add category budget" dashed row stays; use `Button variant="ghost"`.

### 4.5 Commitments
- Rows grouped in one `Card` (or flush list). Overdue still danger text +
  Badge. Row still navigates to detail.
- Pull-to-refresh. Skeleton.
- FAB stays.

### 4.6 Analytics
- Total card / breakdown / StatGrid / top-expenses compose `Card`.
- Pull-to-refresh. Skeleton of total + 2×2 grid.
- Top-expenses rows: tapping a row is **out of scope** (snapshot items may
  not carry a navigable expense id in a way the UI already uses — verify
  `largest[].id` exists; if it does, tap → `/expenses/${id}`. That's a
  named, small bonus, not required).

### 4.7 Settings
- Reorder into **grouped lists**, not mixed cards:
  1. Signed-in identity (email) — keep
  2. **Money** — accounts (grouped) + payroll + safety buffer
  3. **Categories** — chips (already 017)
  4. **AI** — status pills + provider rows + active selector
  5. Log out (`Button variant="danger"`)
- Sticky mini-TOC is out of scope. The grouping + extra vertical rhythm is
  enough to make AI reachable without three full swipes.
- Account rows use `ListRow` (trash stays a separate hit target).
- Buffer editor stays a card (it's a form, not a row).

### 4.8 Forms (the 017 skip)
- `ExpenseForm`, `CommitmentForm`, `AccountForm`, `BudgetForm`:
  - Pickers → shared `Chip`
  - Submit/cancel → `Button`
  - Input radius 12, minHeight 48 (login already did this)
  - Kill `#fff` / `radius.sm` on buttons
- Expense form layout: **amount first** (already), then category, account,
  date, description. Add a live "After save, {account} → {projected}"
  emphasis (the projected line exists — make it a tinted hint, not muted
  caption).
- Sticky footer for submit+cancel when the keyboard is open is **nice** but
  KeyboardAwareScrollView already lifts fields — don't fight it. Out of
  scope unless a form is still covering the button on the Oppo (it wasn't
  in 017).

### 4.9 Detail screens
- **Expense detail:** amount as `typography.display`; category/date/account
  as `ListRow`s inside one `Card`; Edit/Delete as `Button` secondary +
  danger, not a tiny pill + 40-pt trash. Linked-from-commitment badge stays.
- **Commitment detail:** hero block (name, next due, progress) using the
  same language as SafeToSpend (tinted if overdue). Schedule rows in one
  grouped card. Destructive actions (Cancel / Archive / Delete) below a
  `SectionHeader`, `Button variant="danger"|"ghost"`.

### 4.10 Sheets
- New `Sheet` wraps the existing Modal+scrim pattern:
  - grab handle (4×36, muted, centered)
  - `borderTopLeftRadius/RightRadius: radius.xxl` (24)
  - padding `spacing.xl`
  - scrim = `colors.scrim`
- ConfirmSheet, CalendarSheet, PaymentFlowSheet, AccountBalanceSheet,
  PayrollAllocationSheet, CategoryAddSheet, budgets' BudgetForm modal all
  compose `Sheet`. **Behavior contracts stay** (busy-guard, testIDs,
  `onRequestClose`).

### 4.11 Auth
- Login/register already 017-aligned. Swap submit to `Button`. Drop the
  default-credentials hint **only if you want** — it's a personal app, keep
  it (named: keep).

### 4.12 AI screens
- ProviderConfigScreen buttons → `Button`. Input already 48-pt from 017.
- ActiveProviderSelector / ProviderRow compose `Card`/`ListRow`.
- Autofill-on-key-field (GPM sheet that black-screened adb) is an Android
  autofill issue, not something to "fix" by `importantForAutofill="no"`
  unless we also keep a visible paste path — **out of scope**.

---

## 5. Motion (existing deps)

| Surface | Motion |
|---|---|
| FormulaCard expand | Reanimated `Layout` + `FadeIn` on the breakdown |
| ExpenseList new page | none (pagination should not animate in 50 rows) |
| Toast | already 150 ms fade — keep |
| Tab switch | system default — keep |
| Sheet | keep `animationType="slide"` |

No spring physics rewrite. No gesture-driven sheet dismiss beyond the
existing scrim tap + back.

---

## 6. Files likely affected

**New**
- `src/components/ui/Button.tsx`
- `src/components/ui/Sheet.tsx`
- `src/components/ui/List.tsx` (`List`, `ListRow`, `SectionLabel`)
- `src/components/ui/Skeleton.tsx`
- `src/components/ui/IconButton.tsx`
- `docs/plans/018-ui-ux-flows.md` (this file)

**Theme**
- `src/theme/colors.ts` — additive `scrim`, `onAccent`
- `src/theme/spacing.ts` — additive `shadows.hero`
- `src/theme/__tests__/tokens.test.ts` — only if we touch asserted pairs
  (we should not)

**Navigation / screens**
- `src/app/(tabs)/_layout.tsx`
- `src/app/(tabs)/index.tsx` — FAB, header gear, skeleton
- `src/app/(tabs)/expenses.tsx` — PTR, skeleton
- `src/app/(tabs)/budgets.tsx`
- `src/app/(tabs)/commitments.tsx`
- `src/app/(tabs)/analytics.tsx`
- `src/app/(tabs)/settings.tsx` — grouping
- `src/app/expenses/[id]/index.tsx`
- `src/app/commitments/[id]/index.tsx`

**Lists / dashboard**
- `src/components/ExpenseList.tsx` — SectionList + date groups
- `src/components/ExpenseRow.tsx` — drop outer card chrome
- `src/components/dashboard/UpcomingList.tsx` — Pressable rows
- `src/components/dashboard/CategorySummary.tsx` — Pressable rows
- `src/components/dashboard/HeroCard.tsx` — `shadows.hero`
- `src/components/BudgetCard.tsx`, `BudgetRow.tsx`
- `src/components/AccountRow.tsx`
- `src/components/ScheduleRow.tsx`

**Forms / sheets**
- `ExpenseForm`, `CommitmentForm`, `AccountForm`, `BudgetForm`
- `ConfirmSheet`, `CalendarSheet`, `PaymentFlowSheet`,
  `AccountBalanceSheet`, `PayrollAllocationSheet`, `CategoryAddSheet`

**Store (tiny, named)**
- Dashboard category-row → expenses filter: already `setExpenseCategory`.
  No new store fields.

**Tests to extend, not rewrite**
- `heroCard.test.tsx` — still 44-pt eye, still `********`
- `emptyState.test.tsx`
- `settingsScreen.test.tsx` — still `/settings`, still status testIDs
- `commitmentsScreen.test.tsx` — row order
- New: `ExpenseList` grouping is presentational — add a unit test that
  given three expenses on two dates, two section headers render. Keep
  `expense-row-*` findable.
- New: UpcomingList row is a button (accessibilityRole) — small component
  test.

---

## 7. Edge cases

- **Settings with `href: null`.** Deep links / `router.push('/settings')`
  still work. The Settings tab icon disappears — that's the point.
- **Expense pagination + date headers.** A 50-row page that starts mid-day
  will show that day's header at the top of the page even if earlier rows
  of the same day were in the previous page. Acceptable.
- **Empty Expenses with filters.** Existing empty-filtered EmptyState
  stays; no section headers.
- **Dashboard with 0 upcoming.** Empty copy stays; no fake rows.
- **Category row with unknown id.** Already falls back to `Category ${id}`.
- **Header gear vs signed-out.** Tabs layout already redirects signed-out
  users; gear never mounts.
- **Success toast vs error toast.** Same `ToastProvider.show`. Success
  copy is short (`"Expense saved"`); errors stay `"Could not …"`.

---

## 8. Out of scope

- Dark mode
- Haptics / new native modules
- Changing plan-010 dashboard card order
- Changing SafeToSpend / cash-flow math
- Rewriting sheets as gesture-handler bottomsheets
- Onboarding / empty-account walkthrough beyond existing EmptyState CTAs
- Charts (A3: View bars only)
- Removing the login default-credentials hint
- Autofill service workarounds on the API-key field
- iOS-specific large titles / blur headers

---

## 9. Implementation order (for the next agent)

1. Tokens (`onAccent`, `scrim`, `shadows.hero`) + `Button` + `IconButton`
2. `Sheet` + migrate ConfirmSheet (highest-leverage, all destructive flows)
3. `List`/`ListRow`/`SectionLabel` + ExpenseList date grouping + ExpenseRow
4. Five-tab layout + Dashboard header gear + Dashboard FAB + tappable
   upcoming/category rows
5. Skeletons + pull-to-refresh on the other four tabs
6. Forms → Chip + Button
7. Remaining sheets compose `Sheet`
8. Settings grouping + detail-screen hierarchy
9. Success toasts on write paths
10. `npm run typecheck && npm run lint && npm test` — all green

Each step is independently shippable. 1–4 are the user-visible core; 5–9
are polish on top.

---

## 10. Acceptance criteria

- Tab bar has **five** destinations; Settings is opened from the Dashboard
  gear; `router.push('/settings')` still works; all existing settings
  testIDs pass.
- Dashboard upcoming rows navigate to the commitment; category rows open
  Expenses filtered to that category; a FAB records an expense.
- Expenses list is grouped by date; `expense-row-${id}` still finds rows;
  pagination still 50/batch.
- Expense/commitment/account/budget forms use `Chip` + `Button`; no `#fff`
  in those files.
- Every bottom-sheet shares handle + radius + scrim.
- Saving an expense shows a success toast.
- Loading a tab shows layout skeletons, not a lone spinner (except the
  root DB gate, which stays `DbLoadingScreen`).
- `tokens.test.ts` contrast pairs unchanged.
- 766+ tests green; typecheck + lint clean.

---

## 11. Unresolved (need a call if you disagree)

1. **Settings off the tab bar** — this plan assumes yes. Alternative: keep
   six tabs, drop the gear.
2. **Commitments tab label** — this plan reverts to `Commitments` once
   there are five slots. Alternative: keep `Bills` / `Recurring`.
3. **Tapping an Analytics top-expense** — bonus, not required.
4. **Sticky form submit** — out unless you still see the keyboard covering
   Save on the Oppo.
