# 021 — Spending Tracker: Apple Wallet Redesign & Theming

| | |
|---|---|
| **Status** | Implemented 2026-10-11 |
| **Version** | 1.0 |
| **Date** | 2026-10-11 |
| **Dependencies** | 018, 019, 020 (Phases B & C) |
| **Specification** | [`newUIDesign/design.jsonc`](file:///Users/ooiguancheng/Documents/projects/spending-tracker/newUIDesign/design.jsonc), [`newUIDesign/README.md`](file:///Users/ooiguancheng/Documents/projects/spending-tracker/newUIDesign/README.md) |

## Objective

Complete visual and architectural redesign of the Spending Tracker UI matching the approved Apple Wallet design spec.
Eliminate dark/light visual inconsistencies by replacing NativeWind `className` styling with a unified React Native `StyleSheet` + `ThemeProvider` token system (`themes.dark` and `themes.light`). Ensure rock-solid layout on the target Oppo Reno 10 Pro+ (354×792 dp) and responsiveness from 320 dp to 430 dp.

## Delivered Architecture

### 1. Dual Themes & Tokens
- Dual theme token system (`themes.dark` OLED black and `themes.light` soft light grey).
- `ThemeProvider` and `useTheme()` hook delivering `{ mode, scheme, colors, setMode }`.
- Live appearance switching in Settings (System / Light / Dark), persisted in SQLite `settings.theme_mode`.
- WCAG AA contrast (≥4.5:1) verified for both themes in `src/theme/__tests__/tokens.test.ts`.
- Geist typeface (`@expo-google-fonts/geist`) with tabular numbers (`tabularNumsVariant`) across all currency figures.

### 2. Physical Card Metaphor & Wallet Stack
- Physical card palettes:
  - Bank: `#24408F`
  - Cash: `#0E6B63`
  - SPayLater: `#B8430F`
  - Credit Card: `#3A3A3C` (dark) / `#1F1F21` (light)
  - E-wallet: `#5A3E9E`
- `WalletStack`: stacked cards (-18 dp overlap) with accordion expand/collapse interaction (220 ms Reanimated ease).
- Detail lines show recent expenses for asset accounts, and billing cycles + "Pay" pills for credit/SPayLater accounts.

### 3. Credit Bills & Payment (Plan 020 Phase B)
- SPayLater and credit cards have billing cycles: `statement_day`, `due_day`, and `opening_owed_sen`.
- Pure engine `src/engine/creditBills.ts` derives closed bills, open bills, and installment parts with monthly interest.
- `PaySheet`: Pay closed bills from a bank or cash account without creating new expenses. Overpayment guard enforced inside transaction.

### 4. Analytics by Period (Plan 020 Phase C)
- Category filter horizontal scroll ("All" + categories).
- Period switcher: Day (30 days), Week (12 weeks Monday-start), Month (12 months).
- Pure engine `spendingSeries.ts` feeding SVG `BarChart` with interactive bar selection and highest period highlight.
- Category breakdown with progress bars and percentage share.

### 5. Navigation & Chrome
- Custom floating `TabBar`: Home, Expenses, (+) centre modal button (48 dp), Due, Analytics.
- Status bar, Android navigation bar, and `expo-system-ui` window background synced with active theme colors.
- New stacked-cards app icon and splash screen.
