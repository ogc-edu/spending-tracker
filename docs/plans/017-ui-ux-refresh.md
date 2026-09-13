# Plan 017 — UI/UX Refresh

Full design-system pass over every screen: shared primitives, stronger visual
hierarchy, 44-pt touch targets everywhere, consistent press feedback, and a
cleaner information design. **Visual-only** — every testID, accessibility
label, copy string, data order (plan 010 card order) and screen contract is
preserved, so the existing test suite stays green.

No new native dependencies (the installed release APK cannot gain native
modules without a rebuild). Only existing APIs are used: `Pressable`
(+ `android_ripple`), `Animated`, tokens. Per AGENTS.md, this plan uses no new
Expo-version-specific APIs.

## 0. Audit findings (what's wrong today)

| # | Finding | Where |
|---|---------|-------|
| A1 | The same card style block is copy-pasted in ~15 files (incl. literal `#0F172A` hex — violates the "no literal hex" token rule) | HeroCard, UpcomingList, BudgetBar, CategorySummary, SafeToSpendCard, FormulaCard, BudgetCard, BudgetRow, analytics ×3, commitments rows, settings cards… |
| A2 | Filter chips are ~26–28 px tall — **violates the project's own 44-pt touch-target rule** | CategoryFilter, PeriodPicker |
| A3 | Font sizes off the type scale (`32/30/28/26/22/20` literals) and `letterSpacing`/`fontWeight` literals everywhere | HeroCard, SafeToSpendCard, analytics, BudgetCard, StatGrid, login |
| A4 | Dashboard is a stack of identical white cards — no visual anchor; the green headline competes with the accent used on links/buttons | HeroCard + dashboard |
| A5 | Upcoming list rows are plain text — no icons, no urgency tone for overdue/today | UpcomingList |
| A6 | CategorySummary rows show a bare dot — no sense of proportion | CategorySummary |
| A7 | Loud filled MoM chip (solid red/green) vs soft badges elsewhere — inconsistent badge language | MoMChip |
| A8 | Category breakdown bars have no % labels | CategoryBreakdown |
| A9 | Tab labels truncate ("Dashbo…", "Commit…" on the device) | `(tabs)/_layout.tsx` |
| A10 | Press feedback inconsistent (opacity 0.6/0.7/0.75/0.8/0.85), no ripple | everywhere |
| A11 | Inline error text is bare (danger text on background) | all tabs |
| A12 | FAB styles duplicated with literal `#fff` | expenses, commitments |
| A13 | EmptyState icon floats in space — no container | EmptyState |
| A14 | Over-budget mini-badge `fontSize: 10` (below caption scale) | BudgetRow |
| A15 | Settings AI status lines duplicate ProviderRow status; sections drift in spacing | settings.tsx |
| A16 | Progress bars 6 px thin + no shared track token | ProgressBar |

## 1. Design language (decisions)

1. **One hero, everything else calm.** The dashboard's available balance
   becomes the single accent-filled surface (green bg, white text — white on
   `#15803D` is 5.0:1, asserted AA). Healthy/deficit states tint the
   SafeToSpend card (`accentSoft` / `dangerSoft`). All other cards stay white.
2. **Soft-badge language.** All status pills (Over budget, Done, Cancelled,
   commitment-linked, MoM) use tinted background + dark tone text, never
   saturated fills, via one `Badge` component.
3. **Pill chips at 44 pt.** One `Chip` component (min height
   `MIN_TOUCH_TARGET`, pill radius) for every filter chip row.
4. **Consistent press feedback**: `android_ripple` + pressed opacity 0.7 on
   row surfaces; shared `Fab`.
5. **Progress bars** grow to 8 px with a rounded cap; share bars added where a
   proportion is meaningful (category summary, breakdown).
6. **Type scale discipline**: new `typography.display = 34` for the two
   headline money figures (hero, analytics total); everything else maps to
   existing tokens.

## 2. New shared components (`src/components/ui/`)

| Component | API | Notes |
|---|---|---|
| `Card` | `tone: 'plain'\|'tint'\|'danger'\|'accent'`, `style`, `testID` | Replaces every copy-pasted card block; uses `shadows.card`, `radius.lg`, `spacing` tokens |
| `Badge` | `tone: 'accent'\|'danger'\|'warning'\|'neutral'\|'onAccent'`, `label`, `icon?` | Soft pill; `onAccent` = translucent-dark bg + white text (hero) |
| `Chip` | `selected`, `icon?`, `iconColor?`, `onPress`, `disabled?` | ≥44 pt pill; accent fill when selected |
| `Fab` | `onPress`, `label`, `testID` | Shared 58-pt FAB with ripple + press scale |
| `SectionHeader` | `title`, `note?`, `trailing?: ReactNode` | Consistent section titles on Budgets/Analytics/Settings |
| `InlineError` | `message` | `dangerSoft` panel with warning icon — replaces bare red `errorText` |

## 3. Screen-by-screen changes

### 3.1 Theme
- `typography.ts`: add `display: 34` (hero + analytics total).
- `ProgressBar.tsx`: height 6 → 8, radius 4.

### 3.2 Tabs
- `tabBarLabel` short forms: **Home**, Expenses, Budgets, **Recurring**
  (header title stays "Commitments"), Analytics, Settings — fixes truncation.
- Label fontSize 10.5, keep icons/borders.

### 3.3 Dashboard (`index.tsx` + `dashboard/*`)
- `HeroCard`: accent-filled hero (green bg, white headline `typography.display`,
  white stat values, hairline `rgba(255,255,255,0.25)` dividers, dark-translucent
  label badge — all white-on-green pairs ≥ 4.5:1); eye toggle white.
- `UpcomingList`: per-row leading icon circles, overdue rows tinted danger
  (badge "Overdue"), relative date labels kept.
- `CategorySummary`: per-row share bar (share of month spend) + pct label.
- `SafeToSpendCard`: healthy → `accentSoft` tinted card; deficit unchanged
  (danger tint); Badge for the label.
- `FormulaCard`: unchanged logic; card via `Card`, row rhythm tweaks.
- `BudgetBar`: Badge for "Over budget"; metrics line keeps testIDs.
- Screen: `InlineError` for `error`; card order untouched.

### 3.4 Expenses
- `FilterBar`: search field ≥44 pt, radius `md`, "Search expenses".
- `CategoryFilter` / `PeriodPicker`: via shared `Chip` (44 pt, pill).
- `ExpenseRow`: ripple, linked chip via `Badge`, unchanged testIDs.
- Screen: totals bar restyled (emphasis on total), `InlineError`, FAB via `Fab`.

### 3.5 Budgets
- `BudgetCard` / `BudgetRow`: via `Card`; over badge via `Badge` (caption, not 10 px);
  progress 8 px; month bar gets a segmented surface + centered label.

### 3.6 Analytics
- `MoMChip`: soft tinted badge (danger soft bg + danger text when up; accent
  soft + accent when down; muted neutral) — same text content.
- `CategoryBreakdown`: pct label right-aligned, 8 px bars.
- `StatGrid`: value `typography.emphasis`; via `Card`.
- Top-expenses section: separators + rank ordering unchanged; `InlineError`.

### 3.7 Commitments
- Rows: ripple + `Badge` for status/overdue (danger tint when overdue),
  icon circles kept, "All paid" muted badge.
- Archived section header unchanged; FAB via `Fab`.

### 3.8 Settings
- `SectionHeader` everywhere; AI status lines become compact status pills
  (same testIDs); logout softens to danger-tinted button (still destructive-red).
- Account rows/payroll rows keep behavior; cards via `Card`.

### 3.9 AI screens
- `ProviderConfigScreen`: input radius `md`, minHeight 48; buttons keep
  primary/outline/danger roles, aligned radius.
- `ProviderRow`, `ActiveProviderSelector`, `ModelPicker`, `TestResultBadge`: card/badge alignment (no contract changes).
- `AIAnalysisCard`: accent bullets, tinted pending row (no contract changes).

### 3.10 Auth screens
- Inputs radius `md` (match), button radius `md`; brand header unchanged.

### 3.11 Shared bits
- `EmptyState`: icon inside a 72-pt `accentSoft` circle; action button unchanged.

## 4. Out of scope (explicitly)
- Dark mode (theme file says future work), haptics (new native dep), new
  screens, data/behavior changes, renaming testIDs, changing plan-010 card order.

## 5. Verification
- `npm run typecheck`, `npm run lint`, `npm test` — all green.
- Contrast pairs unchanged or improved; tokens test untouched (additive-only
  token change).
- Manual sanity via the installed app is possible only after the user rebuilds
  (build commands stay out of this session per user instruction).
