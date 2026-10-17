# New UI: orchestrator brief

You are the **orchestrator** for rebuilding the Spending Tracker UI to an approved design. You plan the work, split it into waves, send each piece to subagents, review and merge what they return, and run the gates. You are also the final check on device.

Keep your own context for decisions and verification. Delegate the code: write code yourself only for small merge fixes and glue between waves.

The design is **final and approved by the user**. Do not redesign, add visual ideas, or reopen decisions in §3. When something is not specified, use the nearest existing pattern in `design.jsonc`.

---

## 1. What is in this folder

```
newUIDesign/
├── README.md              ← this brief (process)
├── design.jsonc           ← THE spec: tokens (dark + light), type, spacing, components, screens, icon, acceptance
├── images/
│   ├── dark/*.png         ← every screen and state, dark theme (2x renders of 354×792 dp)
│   ├── light/*.png        ← the same screens and states, light theme
│   │                         *-fullscroll.png = the whole scrollable content of that screen
│   ├── icon/*.png         ← exported app icon, adaptive foreground/monochrome, splash, favicon, concept board
│   └── reference/light-theme-reference.png  ← the user's inspiration for the light theme
├── icon/*.svg             ← icon sources (app, adaptive foreground, monochrome, splash)
└── mockups/               ← interactive HTML mockups that the images were rendered from
    ├── index.html         ← all screens side by side (open in a browser; ?theme=light|dark)
    ├── *.dc.html          ← one per screen; theme.css holds the same tokens as design.jsonc
    └── support.js, theme.css
```

Image index (both `dark/` and `light/`):

| Screen | Images |
|---|---|
| Home | `01-home`, `01-home-fullscroll`, `01b-home-cards-collapsed` |
| Due (commitments + SPayLater bills) | `02-due`, `02-due-fullscroll`, `02b-due-pay-sheet`, `02c-due-after-pay` |
| Add expense | `03-add-expense-spaylater-split(-fullscroll)`, `03b-add-expense-6mo-interest(-fullscroll)`, `03c-add-expense-bank` |
| Analytics | `04-analytics-month(-fullscroll)`, `04b-analytics-week`, `04c-analytics-day`, `04d-analytics-food-month` |
| Expenses | `05-expenses`, `05-expenses-fullscroll` |
| Settings (incl. Light/Dark/System) | `06-settings`, `06-settings-fullscroll` |

When sources disagree, use this precedence: **design.jsonc > images > HTML mockups**. The mockups show sample data, so do not copy their numbers. Read images with your image-capable Read tool; hand image paths to subagents as well.

## 2. Read before you plan (in this order)

1. `CLAUDE.md` and `AGENTS.md` at the repo root. These are the architecture invariants, and the instruction to read **Expo SDK 57 versioned docs** before writing Expo code.
2. `newUIDesign/design.jsonc`, all of it.
3. A few images in both themes: at least `01-home`, `02-due`, `03-add-expense-spaylater-split`, `04-analytics-month`, `06-settings`.
4. `docs/plans/020-scope-reset-credit-bills.md`. Phase A is merged. **Phases B (credit/SPayLater bills, instalments with monthly interest) and C (analytics series) are built in this project**, because the new screens depend on them.
5. `docs/ARCHITECTURE.md`: the sections on layers, schema, the engine and data flows.
6. Skim the current screens: `src/app/(tabs)/*.tsx`, `src/components/**`, `src/theme/*`.

## 3. Decisions already made (do not reopen them, and do not ask the user about them)

| # | Decision |
|---|---|
| D1 | Two themes, **dark and light**, chosen in **Settings → Appearance: System / Light / Dark**. Default **Dark**. The setting is stored in the SQLite `settings` table (new column `theme_mode`, default `'dark'`), applies instantly and survives restart. |
| D2 | **One styling system: React Native `StyleSheet` plus a `ThemeProvider` / `useTheme()` that returns the active token set from `src/theme`.** Do not use NativeWind `className` in new or rewritten code. *Why:* today the app mixes NativeWind classes that follow the device's dark mode with light-only StyleSheet tokens. That mix is the root cause of the "UI never matches, glitchy" complaint. Colours are also needed outside styles (react-native-svg, navigation options, status bar), so one TypeScript token source is simplest. Remove NativeWind entirely in Wave 3 only if no `className` usage remains; otherwise leave it installed and unused. |
| D3 | Typeface **Geist** (`@expo-google-fonts/geist`), with tabular figures for every number. |
| D4 | Tab bar: **Home · Expenses · (+) · Due · Analytics**. The centre + opens Add expense and is not a tab. Settings opens from the Home gear. Tab screens have no navigation header; they use in-content large titles. |
| D5 | Home: title block, **Spent this month \| Due by end of month**, the Wallet-style account card stack, then the "Due by …" list. CategorySummary and the Ask-AI card leave Home: AI sits behind the sparkle button (functionality unchanged), and the category view lives in Analytics. |
| D6 | SPayLater and credit cards are **credit accounts with derived bills**, exactly as in plan 020. They are not commitments. A bill is named after its closing month: 21 Sep – 20 Oct is the "October bill", due 31 Oct. Paying a bill is a transfer and does **not** create an expense. |
| D7 | The new app icon is the three stacked cards in `icon/`. |
| D8 | Payroll stays hidden. No budgets, safe-to-spend or daily allowance (removed in Phase A). |

**Ask the user only if** a change would alter money behaviour beyond plan 020, would delete user data, or the spec truly contradicts itself. Put each such question into a single message, with your recommended answer.

## 4. Non-negotiables (repeat these in every subagent prompt)

- Four layers: Screen → Service → Repository → Drizzle. **No SQL and no money math in screens or components**; instalment parts, bill totals and series all come from engine and service functions.
- `src/engine/` is pure: no `Date.now()`, no I/O, dates passed in as arguments.
- Money is integer **sen**. Dates are `YYYY-MM-DD` strings.
- Schema change → `npm run db:generate` → commit `drizzle/*.sql` + `drizzle/migrations.js`. **Only one agent per wave may touch the schema or migrations.**
- No hex or `rgba()` literals in `src/app` or `src/components`; use theme tokens only. Palettes such as account cards, categories and on-card colours live in `src/theme`.
- Every text line in a row uses `numberOfLines={1}`. Amounts never wrap: use `adjustsFontSizeToFit` with `minimumFontScale 0.7`. No half-width column of free text without these rules.
- Touch targets ≥ 44 dp. Text contrast ≥ 4.5:1. Both are asserted in `src/theme/__tests__/tokens.test.ts`; update it for both themes.
- Keep existing `testID`s where the element survives, so tests stay meaningful. Delete tests only for behaviour that was deliberately removed, and say so.
- Gates for every merge: `npm test`, `npm run typecheck`, `npm run lint`, all green.
- Commit style: `type(scope): summary`.

## 5. Waves

Work on a branch: `git checkout -b feature/new-ui` from `main`. Before any change, run the three gates and record the baseline.

Run the parallel agents in a wave with `isolation: "worktree"` so they cannot trample each other's working tree or typecheck. Merge their branches yourself, one at a time, and run the gates after each merge. Give every agent an explicit **owned paths** list and a **do not touch** list.

### Wave 1: foundations (2 agents in parallel)

**1A, UI foundation.** Owns `src/theme/**`, `src/components/ui/**` (new primitives), `src/app/_layout.tsx` (providers, fonts, system chrome) and `package.json` (font dependency only).
- Tokens: `themes.dark` and `themes.light`, `accountCards`, `categoryPalette`, the `onCard` constants, typography, spacing, radius, sizes and motion from `design.jsonc`. `useTheme()` returns `{ mode, scheme, colors, setMode }`.
- `ThemeProvider` takes `initialMode` and `onModeChange(mode)` props. Wave 2 wires them to the settings service, so 1A must **not** touch the DB. Resolve `system` with RN `useColorScheme`. Before the DB is ready, use the OS scheme with dark as fallback.
- System chrome: `expo-status-bar` style per theme; root and navigation background from `expo-system-ui` set to `bg`; the Android navigation bar colour.
- Fonts: load Geist in the root layout before hiding the splash, with a system-font fallback.
- Primitives, from the `components` section of the spec:
  - Text variants, Money, Glyph (exact SVG paths), IconButton
  - Chip, FilterPill, SegmentedControl, Switch, Stepper, OptionTile
  - PrimaryButton, TextLinkButton
  - Surface, FormGroup, SettingsGroup
  - DateTile, CategoryTile, AccountSwatch
  - DueRow, ExpenseRow, DayHeader, BreakdownRow
  - Sheet (+ scrim and handle), Toast restyle, EmptyState
  - **BarChart** (presentational; takes `{label, valueSen, a11yLabel}[]`)
  - WalletCard / **WalletStack** (expand and collapse, one open at a time)
  - **CreditAccountCard** (presentational: takes bills and onPay)
  - custom **TabBar**
- Tests: render each primitive in both themes; update the contrast checks in `tokens.test.ts`.

**1B, domain (plan 020 Phases B and C, no UI).** Owns `src/db/**`, `drizzle/**`, `src/engine/**`, `src/repositories/**`, `src/services/**`, and `src/ai/**` only for the minimal snapshot changes the plan lists.
- Schema and one migration:
  - `paylater` account type, plus `statement_day` and `due_day` on credit accounts, plus `opening_owed_sen`
  - `expense_installments` and `credit_bill_payments`
  - `settings.theme_mode`
- Engine: `creditBills.ts` (cycles, bill naming and due dates, instalment parts with the interest rule) and `spendingSeries`. Add boundary tests for month ends, February, leap years, `due_day ≤ statement_day`, and the remainder going to the last part.
- Services:
  - credit bills: list per account, outstanding, `payBill` as one transaction that refuses overpayment
  - expense creation with an instalment plan
  - `CashFlowService` "due by end of month" includes closed unpaid bills
  - `AnalyticsService` series
  - `SettingsService` `getThemeMode` / `setThemeMode`
- Integration tests on `createMigratedTestDb()`. Also confirm that the migration applies cleanly on top of an existing DB, as Phase A did.
- Its final report must include the **public service API** (signatures and return shapes), because Wave 2 builds on it.

Merge 1B, then 1A, then run the gates. Then write a short **contract note** for Wave 2: the service signatures from 1B and the primitive props from 1A. Paste it into every Wave 2 prompt.

### Wave 2: screens (4 agents in parallel)

Each agent owns whole screens and may add screen-local components under `src/components/<feature>/`. **They must not edit Wave 1 primitives or services.** If a primitive is missing or wrong, they report it and you fix it between merges.

| Agent | Owns | Notes |
|---|---|---|
| **2A Shell, Home, Settings, Accounts** | `(tabs)/_layout.tsx`, `(tabs)/index.tsx`, `(tabs)/settings.tsx`, AccountForm + AccountBalanceSheet, login/register, DbLoading/DbError, the AI ask sheet opened from Home (reuses the existing AskAiCard logic) | Wires `ThemeProvider` to `SettingsService` (Appearance control). AccountForm gains the Pay-later type, statement and due day, and "Owed now". |
| **2B Expenses** | `(tabs)/expenses.tsx`, `expenses/new`, `expenses/[id]` and `[id]/edit`, ExpenseForm, ExpenseList/Row, FilterBar, CategoryFilter, CalendarSheet, CategoryAddSheet | **Fix pagination**: append pages, reset on filter change, no offset kept in Zustand across visits, `keyExtractor` uses the id. The split-into-months block shows only for credit accounts; numbers come from the engine. |
| **2C Due** | `(tabs)/commitments.tsx`, `commitments/**`, CommitmentForm, PaymentFlowSheet, ScheduleRow, the new PaySheet | Pay later and Credit card sections (CreditAccountCard), then Commitments. The Pay flow calls `payBill` and must not create an expense. |
| **2D Analytics, AI settings** | `(tabs)/analytics.tsx`, `src/components/analytics/**`, `settings/ai/**`, `src/components/ai/**` (except the Home ask sheet) | Category chips, Day/Week/Month, BarChart, Highest, Breakdown. Remove the old StatGrid, MoM chip and month selector. |

After each merge, open the matching images and compare against the running app or the rendered tests. Reject or patch drift before you merge the next agent.

### Wave 3: icon, cleanup, docs (1 agent, or do it yourself)

- Copy `images/icon/*.png` into `assets/images` and update `app.json` as in `design.jsonc → appIcon`.
- Delete dead UI: BentoCard, BudgetMeter, MonthSummaryCard, CategorySummary, StatGrid, MoMChip, Fab if unused, and the old palettes. Grep for leftovers.
- `grep -rnE "#[0-9A-Fa-f]{3,8}\b|rgba\(" src/app src/components` must return nothing.
- If `className=` no longer appears anywhere, remove NativeWind: babel and metro config, `tailwind.config.js`, `global.css`, type references. Otherwise keep it.
- Docs:
  - `CLAUDE.md`: the Theme section now describes two themes plus `useTheme`, and the line "single light theme" is gone.
  - `docs/ARCHITECTURE.md`: schema, engine and services from Phase B/C, and theming.
  - `docs/PRD.md`
  - mark plan 020 B/C as done
  - add `docs/plans/021-new-ui.md`, a summary of this redesign that links to `newUIDesign/`

### Wave 4: on-device QA (you, plus one fresh-eyes reviewer agent)

The user's phone is connected over USB:

- **Phone:** Oppo Reno 10 Pro+ (CPH2521), Android 16, 354×792 dp.
- **adb:** `~/Library/Android/sdk/platform-tools/adb`, device id `c452f9c2`.
- **App:** a dev build `com.anonymous.spendingtracker` is installed. `android/` and `ios/` are generated and gitignored.

```bash
npx expo prebuild --clean           # needed for icon/splash/app.json changes
npx expo run:android                # builds and installs the dev build on the connected phone (run in background)
~/Library/Android/sdk/platform-tools/adb -s c452f9c2 exec-out screencap -p > /tmp/<screen>-<theme>.png
```

1. Capture every screen in `images/` in **both** themes (switch them in Settings) and compare side by side. Give the screenshots and the matching images to a reviewer agent that has not seen the code. Ask for a list of visual differences ranked by severity, then send fixes out.
2. Stress checks. These change settings on the user's phone, so **always restore them afterwards and tell the user you did**:
   - narrow screen: `adb shell wm density 600` (about 330 dp wide), then `adb shell wm density reset`
   - large text: `adb shell settings put system font_scale 1.3`, then `... font_scale 1.0`
   - Look for wrapped amounts, clipped labels, overlap, and one-character-per-line columns.
3. Scroll Expenses through more than 200 rows (seed through the app or a dev-only script that you do not commit). Check that no rows are duplicated or missing.
4. Run a theme switch, kill the app, and relaunch. The theme must persist, with no white flash.

### Definition of done

- Every item in `design.jsonc → acceptance` holds.
- The gates are green.
- Device screenshots in both themes have been reviewed.
- Docs are updated.
- Everything is committed on `feature/new-ui`.

Then report to the user: what changed, the screenshots, and anything deviating from the spec with the reason. **Ask before merging into `main`. Never push unless asked.**

## 6. Subagent prompt template

Every subagent starts with no context, so each prompt has to stand on its own:

```
You are implementing part of an approved UI redesign for an Expo SDK 57 / RN 0.86 app at
/Users/ooiguancheng/Documents/projects/spending-tracker. Read first: CLAUDE.md, AGENTS.md (use the
versioned Expo 57 docs), newUIDesign/design.jsonc sections <…>, and these images (read them):
newUIDesign/images/dark/<…>.png and newUIDesign/images/light/<…>.png.
[Wave 2 only] Contract from Wave 1: <paste service signatures + primitive props>.

Task: <one paragraph, the screens and states to build, and the behaviour>.
You own: <paths>. Do not modify: <paths>. If you need something outside your paths, stop and
report it instead.
Rules: <paste §4 non-negotiables>.
Done when: matches the images in both themes at 354 dp; tests added or updated for <…>;
`npm test`, `npm run typecheck`, `npm run lint` pass; committed as `type(scope): …`.
Report back: files changed; tests added, changed or deleted (and why); any deviation from the
design with reason; anything missing in primitives or services; known issues.
```

## 7. Known problems in the current code (make sure they are gone)

- NativeWind `dark:` classes follow the device setting while StyleSheet tokens are light-only. The result is mismatched surfaces and text on a dark phone.
- On the old Home, a half-width bento column on the 354 dp screen wrapped text one character per line and grew "infinitely" as you scrolled.
- Expenses pagination calls `setExpenses(rows)` on offset change, which replaces rows instead of appending them. The offset is held in Zustand, and `keyExtractor` uses the index.
- Fixed sizes with no responsiveness: test at 330, 354 and 412 dp.
