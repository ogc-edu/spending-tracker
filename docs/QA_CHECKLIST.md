# QA Checklist — MVP DoD sweep (plan 016)

Every PRD §11 DoD item mapped to a concrete on-device step + expected
result. Run with **airplane mode ON** for DoD 16 (non-AI fully functional;
AI actions show their typed error). Environment: Android emulator
`Pixel_9` (Expo Go, JDK 21 toolchain), network disabled via
`adb shell svc wifi disable` / `svc data disable`.

Status key: ✅ verified on-device · 🟡 code-complete-only (not verifiable
locally) · ⚠️ deviation (explained inline)

---

## DoD 1 — Open the app and land on a correct dashboard

| Step | Expected | Status |
|---|---|---|
| Launch Expo Go → Spending Tracker. First run seeds the default user. | Login screen appears (auto-login only after a session exists). | |
| Log in as `ooiguancheng18@gmail.com` / `1234`. | Dashboard renders: HeroCard (Available/Spent/Remaining), SafeToSpendCard, FormulaCard, BudgetBar, Upcoming, category summary. All amounts formatted `RMx,xxx.xx`. | |
| With **no accounts**: dashboard shows the EmptyState "No accounts yet" with a Create-an-account CTA → Settings. | CTA navigates to Settings → Accounts. | |
| With accounts but no expenses/budgets/commitments: "No data yet" EmptyState with a Record-an-expense CTA. | CTA → New Expense. Cards still render the (zeroed) cash flow. | |

## DoD 2 — Create/select an account (with initial balance)

| Step | Expected | Status |
|---|---|---|
| Settings → Accounts → Add account → fill name, type (Cash/Bank/E-wallet/Credit card), initial balance → Save. | Row appears in the list; Dashboard Available = initial balance. Credit card: balance shown as "Owed" and counted negatively. | |
| Delete an account → native confirm "Delete account". | Account gone; available money updates. Deleting an account that has linked expenses fails with a toast (FK protection). | |

## DoD 3 — Record ordinary expenses manually in a few seconds

| Step | Expected | Status |
|---|---|---|
| Expenses → FAB → amount auto-focused; type amount, pick category/account (prefilled last-used), Save. | Row appears in history; account balance + spent-this-month on Dashboard update; totals bar shows the new total. | |
| Validation: `0`, `-5`, `12.345`, `abc` in the amount field. | Inline field error; nothing saved. Double-tap Save during submit is blocked (button disabled). | |

## DoD 4 — Browse, search, filter, edit, delete expense history

| Step | Expected | Status |
|---|---|---|
| Search "lunch" in the FilterBar. | Only matching descriptions; totals bar reflects the filtered set. | |
| Category filter / period presets / custom range. | List + totals match the filter; "No matching expenses" EmptyState with a Clear-filters action when nothing matches. | |
| Open an expense → Edit → change amount/date → Save. | Same row updated (no duplicate); balance delta re-applied. | |
| Delete an expense → ConfirmSheet (bottom sheet) → Delete. | Confirm fires once; row removed; balances restored; toast only on failure. | |
| Spend on a credit-card account. | Account owed amount increases. | |

## DoD 5 — Set an overall monthly budget

| Step | Expected | Status |
|---|---|---|
| Budgets tab → tap the overall card → amount → Save. | BudgetCard shows amount/spent/remaining/% ; BudgetBar on Dashboard uses it (cash-flow formula reserves it). | |
| Clear the overall budget via Clear → ConfirmSheet. | Confirm clears; Expenses stay. | |

## DoD 6 — Category budgets with per-category metrics

| Step | Expected | Status |
|---|---|---|
| Set a Food category budget. | Row shows spent/remaining/%/over-budget; "Over budget" badge when spent exceeds the budget (danger color, never a notification). | |
| No budgets at all → EmptyState "No budgets set" with a Set-a-monthly-budget action. | Action opens the overall budget form. | |

## DoD 7 — Commitments (monthly/one-time) with derived schedules

| Step | Expected | Status |
|---|---|---|
| Commitments → FAB → create a fixed monthly installment (e.g. RM500 × 3). | Detail shows the derived schedule (3 slots; last slot absorbs any remainder). | |
| Create an ongoing monthly (rent) and a one-time payment. | Ongoing derives slots on the fly; one-time = single slot on the due date. | |
| No commitments → EmptyState "No commitments" with an Add-commitment action. | Action → New Commitment. | |

## DoD 8 — Mark payments paid → linked Debt/Repayment expense

| Step | Expected | Status |
|---|---|---|
| Mark a slot paid (PaymentFlowSheet, account prefilled from last-used). | Row flips to Paid with paid date + paying account; remaining amount decrements; an Expense with category **Debt / Repayment** appears in History, linked to the payment (badge). Dashboard spent/available update exactly once. | |
| Double-tap Mark paid. | Only one expense created (unique `commitment_payment_id`). | |
| Un-pay a paid slot → ConfirmSheet. | Linked expense removed, remaining restored, balance reversed. | |

## DoD 9 — See how much they have spent (this month, any month)

| Step | Expected | Status |
|---|---|---|
| Dashboard Spent-this-month + HeroCard. | Matches the month's expense total. | |
| Analytics month arrows (incl. a past month with expenses). | Month total, category breakdown, MoM chip, top expenses. | |

## DoD 10 — See upcoming obligations (total due before next month)

| Step | Expected | Status |
|---|---|---|
| Dashboard Upcoming card with unpaid slots. | Up to 3 slots + "Due before 01 Oct" total; overdue slots included and flagged. Empty → "Nothing due before next month". | |

## DoD 11 — Safe-to-spend with expandable formula breakdown

| Step | Expected | Status |
|---|---|---|
| Expand "The formula" on the Dashboard. | Rows = Available − Upcoming − Remaining budget − Buffer; **rows sum back to the safe headline**. | |
| Change the safety buffer in Settings → verify. | Safe updates by the same delta. | |

## DoD 12 — Daily spending allowance

| Step | Expected | Status |
|---|---|---|
| SafeToSpendCard daily chip. | `RMx.xx / day` (= safe ÷ remaining days, floor to sen). | |
| Deficit state (safe < 0). | Card flips to danger: "No safe-to-spend", negative headline, "—" allowance, warning copy "Cover your commitments and safety buffer…". | |

## DoD 13 — Spending analytics (breakdown, MoM, averages, largest, projection)

| Step | Expected | Status |
|---|---|---|
| Analytics tab with data. | Monthly total; category breakdown; MoM Δ sen + %; average/day; projection; top expenses (no descriptions — A6). | |
| Empty month. | "No expenses this month" EmptyState with a Record-an-expense action. | |

## DoD 14–15 — AI analysis (commitments + spending) from pre-computed data

| Step | Expected | Status |
|---|---|---|
| Configure a Gemini key (Settings → AI Provider → Gemini → save key → Test Connection). | "Gemini · key configured" status line; Test Connection distinguishes invalid key/quota/model/network. | |
| Commitments → "Analyze my debt"; Analytics → "Analyze my spending"; Dashboard → "Explain my allowance". | Card shows pending → validated result (summary + points) built only from supplied snapshot values. | |
| No provider configured. | AI action shows "No AI provider configured" inline; everything else works. | |

## DoD 16 — Every non-AI feature with network disabled; AI shows a clear error

> Run this entire sweep with airplane mode on (`adb shell svc wifi disable` +
> `svc data disable`).

| Step | Expected | Status |
|---|---|---|
| DoD 1–13 flows above with the network off. | All non-AI features work exactly as online. | |
| AI action while offline. | Inline typed error ("Could not reach… network"), Retry present; no crash; app fully usable. | |
| (Sweep result) | Record: date, device, Expo Go version, pass/fail per item. | |

## DoD 17 — Register/login/logout; per-user data isolation

| Step | Expected | Status |
|---|---|---|
| Log out (Settings → Log out). | Returns to login; tabs unreachable while signed out. | |
| Register a NEW account (different email). | Creates user + signs in; Dashboard shows an EMPTY dataset (no seed accounts/expenses). | |
| Switch back to the seeded user. | Seeded user's accounts/expenses/budgets/commitments are exactly as left; the new user's data is invisible and vice versa (user_id scoping). | |

---

## Accessibility pass (plan 016)

| Check | Expected | Status |
|---|---|---|
| Theme contrast | Every theme text pair ≥ 4.5:1 (asserted in `tokens.test.ts`; accent/danger/warning darkened for AA). | |
| Touch targets | All interactive elements ≥ 44pt (`MIN_TOUCH_TARGET`; asserted in component tests). | |
| Screen-reader labels | Money figures read with context: "Safe to spend, one thousand nine hundred ringgit" etc. (`spokenMoneyLabel`). | |
| Form labels | TextInputs have `accessibilityLabel` (+ `accessibilityLabelledBy` on expense/login/settings inputs). | |
| Tabular figures | Money text uses `moneyFontVariant` (iOS tabular-nums; Android Roboto tabular natively). | |

## iOS parity pass (plan 016 — code-complete; iOS simulator optional)

| Check | Expected | Status |
|---|---|---|
| Keyboard avoiding | `KeyboardScreen` wraps every input screen (expense forms, commitment form, provider config, settings, login/register); budget modal KeyboardAvoidingView. | |
| Safe area | `SafeAreaProvider` at root; login/register SafeAreaView edges; toast floats above the home indicator. | |
| app.json iOS entries | `ios.bundleIdentifier`, `ios.icon` (`./assets/expo.icon` — verified via `npx expo config`), splash via the expo-splash-screen plugin. | |
| jest-expo ios preset | Suite runs under the ios preset (default `jest-expo` = Platform.OS ios; pinned in `tokens.test.ts`); `npm run test:ios` exercises the explicit preset. | |
| Keychain-reinstall | iOS SecureStore survives uninstall — stale `current_user_id` is validated against `users` on boot → signed out (ARCH §12). AI keys intentionally persist through reinstall (BYOK convenience) — deliberate choice documented in README. | |

## Full-suite result

| Gate | Result |
|---|---|
| `npm test` | |
| `npm run test:ios` | |
| `npm run typecheck` | |
| `npm run lint` | |

**Sweep executed:** <date> · Pixel_9 emulator · Expo Go · network off —
see individual Status cells above.