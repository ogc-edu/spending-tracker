# Spending Tracker — Complete App Specification & UI Redesign Blueprint

> **Purpose**: This document provides an exhaustive specification of the Spending Tracker application—covering core functionalities, business logic, screen-by-screen layouts, and a concrete directive for a complete visual and architectural UI redesign. Provide this document to an AI agent or design engineer to implement a fresh, modern, professional UI.

---

## 1. Executive Summary & App Identity

**Spending Tracker** is a high-precision, privacy-focused, local-first mobile personal finance application built with **React Native (Expo 57 / Expo Router v4)** and **SQLite (Drizzle ORM)**. 

### Core Value Proposition
Unlike basic expense logs that only report what was already spent, this app is built around **forward-looking cash flow intelligence**:
1. **The "Safe to Spend" Engine**: Computes exact discretionary spending available today by subtracting upcoming unpaid fixed commitments and monthly budget reserves from liquid account balances.
2. **Commitments Lifecycle**: Tracks recurring subscriptions, fixed loan amortizations, and one-time upcoming obligations, automatically generating linked expense records when marked paid.
3. **Sen-Accurate Financial Mathematics**: All monetary figures are stored and calculated as integer **sen** (1 Ringgit = 100 sen) to eliminate floating-point rounding errors. Currency format: Malaysian Ringgit (`RM`).
4. **Local-First & Private (BYOK AI)**: Zero cloud sync of personal financial data. SQLite database runs on-device. AI features use Bring-Your-Own-Key (BYOK) for Google Gemini and DeepSeek.

---

## 2. Why the Current UI Needs a Total Redesign

### Current Deficiencies ("The Problems")
1. **Dull, Washed-Out Palette**: Uses a generic off-white background (`#F7F8FA`) with an uninspired corporate green (`#15803D`) and flat gray borders (`#E5E7EB`). It looks like a default starter template rather than a modern consumer fintech app.
2. **Repetitive, Stacked Card Fatigue**: Almost every screen is a plain vertical stack of identical white rounded boxes with uniform borders. There is no dynamic rhythm, no Bento-grid visual hierarchy, and no distinctive hero treatment.
3. **Lack of Contrast & Visual Polish**: Key financial numbers blend into text labels. Interactive touchables lack tactile feedback, ambient glow, subtle elevation cues, or modern micro-badges.
4. **Cluttered Dense Controls**: Filter buttons and date chips crowd the top of lists in multi-row clusters instead of clean, smooth segmented controls or horizontal floating filter bars.
5. **Missed Opportunities for Visual Delight**: Progress bars are flat rectangular strips; category badges are standard circles; empty states are generic gray text blocks without expressive illustrations or motivating CTAs.

### Target Aesthetic & Design Direction
The new UI should deliver a **tier-one fintech experience** inspired by modern financial apps (such as *Revolut, Copilot Money, Apple Wallet, Linear, and Cash App*):
- **Color System**: High-contrast, premium, and sophisticated.
  - *Option A (Sleek Dark Mode / Obsidian Luxe)*: Deep rich charcoal/obsidian background (`#090B10` / `#0F131C`), crisp elevated surfaces (`#161B26`), hairline borders (`#232B3B`), electric emerald / neon mint primary accents (`#10B981` / `#00F29D`), vivid coral danger (`#F43F5E`), and warm amber warning (`#F59E0B`).
  - *Option B (Elevated Modern Light / Clean Swiss Fintech)*: Ultra-clean porcelain background (`#F8FAFC`), crisp white elevated cards (`#FFFFFF`) with subtle multi-layer border tokens (`#E2E8F0`), deep obsidian typography (`#0F172A`), electric cyber-emerald accent (`#059669` / `#10B981`), and soft tinted pastels for category tags.
- **Typography & Numerical Display**:
  - Dramatic scale: Massive, confident hero numbers (`text-4xl` / `text-5xl`, tracking tight `-0.03em`) for net balances and daily allowances.
  - Tabular monospace numbers (`tabular-nums` / `fontVariant: ['tabular-nums']`) so financial figures never jitter.
  - Refined micro-labels: Uppercase, tracking-widest (`tracking-wider` / `tracking-widest`), muted captions (`text-[11px] font-semibold text-muted-foreground`).
- **Layout Architecture**:
  - **Bento Grid Dashboard**: Asymmetrical, modular information tiles that group relevant metrics into visually distinct card sizes.
  - **Dynamic Collapsible Headers**: Smooth header transitions that maximize screen real estate when scrolling transactions.
  - **Floating Action Dock / Pill Navigation**: Refined bottom navigation bar with clear active indicators and subtle floating FAB placement.
  - **Native Bottom Sheets**: Frictionless, gesture-driven bottom sheets for forms and quick actions instead of cramped inline inputs.

---

## 3. Detailed Screen-by-Screen Architecture & Functionality

The application consists of **5 main tab screens** plus modal/stack flows.

```
Spending Tracker
├── (tabs)
│   ├── index.tsx         ── Dashboard (Home / Safe-to-Spend / Bento Cards)
│   ├── expenses.tsx      ── Expenses Feed (Filters / Grouped List / Search)
│   ├── budgets.tsx       ── Budgets (Monthly & Category Progress Bars)
│   ├── commitments.tsx   ── Commitments (Debts / Subscriptions / Schedules)
│   ├── analytics.tsx     ── Analytics (Charts / MoM / AI Monthly Review)
│   └── settings.tsx      ── Settings (Accounts / Payroll Split / AI Keys)
├── expenses/
│   ├── new.tsx           ── Fast Expense Entry
│   ├── [id]/index.tsx    ── Expense Details
│   └── [id]/edit.tsx     ── Edit / Delete Expense (E7 Linked Lock)
└── commitments/
    ├── new.tsx           ── Create Commitment
    ├── [id]/index.tsx    ── Commitment Details & Pay History
    └── [id]/edit.tsx     ── Edit Commitment Terms
```

---

### Screen 1: Dashboard (`src/app/(tabs)/index.tsx`)

#### Purpose
The mission-control hub of the user's daily financial life. Answers the single most critical question in seconds: **"How much money can I safely spend right now without missing upcoming bills or breaking my monthly budget?"**

#### Functional Requirements & Calculations
1. **Safe-to-Spend Engine (`cashflowMetrics`)**:
   - `available_balance`: Total liquid cash across all non-credit accounts minus credit card debt.
   - `unpaid_commitments`: Total sum of all fixed commitments due within the remaining days of this month.
   - `budget_reserve`: Remaining amount reserved for this month's overall budget (`budget.amount - current_spent`).
   - `safe_to_spend = available_balance - unpaid_commitments - budget_reserve`.
   - `daily_allowance = safe_to_spend / days_remaining_in_month`.
   - State indicators: **Positive** (green/normal), **Warning** (tight margin), **Deficit / Danger** (negative safe-to-spend, bills exceed balance).
2. **Formula Breakdown Card**:
   - Visual step-by-step breakdown explaining the math to build user trust:
     `Liquid Cash - Unpaid Bills - Budget Reserve = Safe to Spend`.
   - Expandable/tappable modal or accordion explaining each variable.
3. **Monthly Budget Snapshot**:
   - Overall budget progress bar, total spent vs target amount, percentage used, remaining ringgit.
   - Turns warning/danger if over budget (`pctUsed > 100%`).
4. **Upcoming Commitments Carousel / Quick-List**:
   - Shows the next 3 due commitments (e.g., "Car Loan due in 3 days", "Netflix due in 6 days").
   - Includes quick-pay action button directly from dashboard.
5. **Top Spending Categories Widget**:
   - Mini breakdown of the top 3-4 categories dominating current month's expenses.
6. **Ask AI / Daily Insight Card**:
   - Contextual widget allowing one-tap prompt: *"Analyze my spending pace this month"* or *"Explain my allowance"*.
   - Renders inline loading indicator and structured bullet responses.

#### Target Redesign Layout
- **Hero Bento Section**: A striking, glowing gradient or dark obsidian card for the **Safe to Spend** & **Daily Allowance**. Emphasize the daily number in huge bold type (e.g. `RM 42.50 / day left`).
- **Interactive Quick-Action Floating Strip**: Quick actions for `+ Add Expense`, `Transfer`, and `Scan Receipt`.
- **Bento Grid Layout**: Asymmetrical 2-column grid displaying the Budget meter alongside upcoming bill countdown chips.
- **Micro-Timeline**: Clean upcoming bill calendar chips with due-date badges.

---

### Screen 2: Expenses Feed (`src/app/(tabs)/expenses.tsx`)

#### Purpose
The primary transaction ledger. Enables blazing-fast browsing, filtering, search, and audit of historical expenses.

#### Functional Requirements
1. **Search & Instant Filtering**:
   - Search input matching expense notes and descriptions in real time.
   - Preset time range filter: `Today`, `This Week`, `This Month`, `Last Month`, `Custom Date`.
   - Category filter pills: Horizontal scrolling pills representing seeded and user-created categories with their distinct icons.
   - Account filter: Filter expenses by specific payment account.
2. **Period Summary Bar**:
   - Sticky / prominent header displaying the filtered total: e.g., `TOTAL RM 1,420.00` alongside transaction count badge `(28 expenses)`.
3. **Grouped Date Feed**:
   - Expenses grouped by date headers (e.g., `Today, 6 Oct`, `Yesterday, 5 Oct`, `Monday, 29 Sep`).
   - Each date header displays the aggregate total spent on that individual day.
4. **Transaction Row Item**:
   - Category icon with branded background bubble.
   - Title / Description (or fallback to Category name).
   - Subtitle: Timestamp, Category name, Account name (e.g., `12:45 PM · Food · Maybank`).
   - Right side: Formatted negative amount (`-RM 24.50`) in bold tabular numbers.
   - Commitment badge indicator: If the expense was auto-created from a paid commitment, display a distinct `Linked Commitment` pill.
5. **Actions**:
   - Tap row to navigate to details (`/expenses/[id]`).
   - Swipe actions (or tap options) for quick edit and delete.
   - Prominent FAB (`+`) button to initiate Fast Expense Entry.

#### Target Redesign Layout
- **Minimalist Search & Filter Dock**: Replace clunky stacked chip rows with a sleek unified search bar and a smooth single-row horizontal pill carousel with active indicators.
- **Floating Period Summary Pill**: Clean floating or anchored status bar with subtle border, showing total spend and transaction count.
- **Card-Style Date Groups**: Instead of plain text dividers, each day can be enclosed in an elegant card container or separated with refined timeline connectors.

---

### Screen 3: Budgets Manager (`src/app/(tabs)/budgets.tsx`)

#### Purpose
Proactive monthly financial planning. Allows users to set an overall monthly ceiling and per-category budget caps.

#### Functional Requirements
1. **Month Navigator**:
   - Clean stepper to switch between past, current, and upcoming months (`< October 2026 >`).
2. **Overall Monthly Budget Card**:
   - Overall target amount (e.g., `RM 3,500.00`).
   - Current spent and remaining funds (`Spent RM 2,100.00 · Remaining RM 1,400.00`).
   - Utilization percentage and multi-tier progress bar:
     - `< 80%`: Healthy (Emerald/Accent).
     - `80% - 99%`: Caution (Amber/Warning).
     - `≥ 100%`: Over-Budget (Crimson/Danger) with prominent badge and amount exceeded.
   - Tap to edit / set budget modal; quick "Clear" budget option.
3. **Category Budgets List**:
   - Displays all 12 categories.
   - Each category row displays:
     - Category icon and name.
     - Spent so far this month vs budget cap (e.g., `RM 450.00 / RM 600.00`).
     - Progress bar tinted with the category's unique color token.
     - Unset state: shows `—` with a clean `Set limit` trigger.
     - Over-budget warning badge (`Over by RM 50.00`).
4. **Add / Edit Budget Sheet**:
   - Quick keypad input to set or adjust category limits.

#### Target Redesign Layout
- **Circular Gauge or Sleek Multi-segment Bar**: Transform the overall monthly budget into an engaging hero visual (e.g. radial progress ring or sleek glowing bar).
- **Modern Grid/Card Cards for Categories**: Replace flat text rows with compact, beautifully styled category budget cards featuring custom color accents and micro-progress bars.

---

### Screen 4: Commitments & Subscriptions (`src/app/(tabs)/commitments.tsx`)

#### Purpose
Tracking recurring fixed debts, utility bills, subscriptions, and one-off upcoming obligations so cash flow is never blindsided.

#### Functional Requirements
1. **Three Distinct Commitment Models**:
   - **Fixed Amortizing Loans**: Has total principal, monthly payment, start date, and end date (e.g., Car loan: Total RM 60,000, RM 650/mo, remaining balance auto-decremented with paid history).
   - **Ongoing Recurring Bills**: Ongoing monthly subscriptions (e.g., Rent RM 1,200/mo, Netflix RM 55/mo, Gym RM 150/mo).
   - **One-Time Obligations**: Single future obligation with specific due date (e.g., Annual road tax RM 380 due on 15 Nov).
2. **Payment Flow & Ledger Sync**:
   - When user taps **"Mark as Paid"**:
     - Opens account selector modal asking which account was used to pay.
     - Creates a corresponding linked expense in the database automatically.
     - Deducts balance from the selected account.
     - Updates commitment status to `Paid` for the active cycle.
   - When user un-marks or deletes payment, the corresponding expense is reversed and account balance restored.
3. **Amortization Progress**:
   - Fixed loans display progress indicators: `% Paid off`, `Remaining RM X`, `X months left`.
4. **Cycle Status**:
   - Filter chips: `All`, `Due Soon`, `Paid this month`, `Overdue`.

#### Target Redesign Layout
- **Subscription & Loan Cards**: Visual cards styled like mini credit cards or subscription passes, showing due date countdowns (`Due in 4 days`), paid badges, and one-tap pay toggles.
- **Payoff Progress Visualizer**: Sleek progress bar for fixed loans showing journey toward debt-free status.

---

### Screen 5: Analytics & Insights (`src/app/(tabs)/analytics.tsx`)

#### Purpose
Deep visual intelligence on spending behavior, trend analysis, and automated AI financial auditing.

#### Functional Requirements
1. **Month Selector & MoM Indicator**:
   - Switch months; computes Month-over-Month (MoM) change percentage (e.g., `+12.4% vs last month`).
2. **Key Financial Metrics Grid**:
   - Total Monthly Spend.
   - Daily Average Spend (`Total / Days elapsed`).
   - Highest Single Spending Day.
   - Top Spending Category & share percentage.
3. **Category Breakdown**:
   - Ordered ranking of all categories by spend amount.
   - Percentage of total month spend for each.
   - Visual proportion bar or donut chart representation.
4. **AI Financial Review (BYOK)**:
   - "Analyze Month" action button.
   - Sends privacy-safe spending summary snapshot to user's configured Gemini or DeepSeek API.
   - Displays structured output: Executive summary + up to 5 concise bullet insights (anomalies, savings opportunities, pace evaluation).
   - Typed error handling with retry trigger (offline, invalid API key, timeout).

#### Target Redesign Layout
- **Dynamic Chart Surfaces**: Polished category breakdown with animated proportion bars or modern segmented donuts.
- **AI Executive Summary Card**: Premium AI card with shimmering subtle border or accent glow, markdown formatting, and clean bullet indicators.

---

### Screen 6: Settings, Accounts & Payroll (`src/app/(tabs)/settings.tsx`)

#### Purpose
System configuration, multi-account banking management, automated payroll salary distribution, and AI BYOK settings.

#### Functional Requirements
1. **User Profile Section**:
   - User avatar, email address, logout button.
2. **Accounts Management**:
   - Lists all cash, bank, e-wallet, and credit card accounts.
   - Displays real-time balances. For credit cards, shows "Owed" / negative debt.
   - Add Account modal (name, account type, starting balance).
   - Tap account to adjust balance (manual balance correction with audit trail).
3. **Standing Payroll Allocation Engine**:
   - Allows users to configure how their monthly paycheck is distributed across accounts (e.g., Maybank: RM 3,000, Touch'n Go: RM 500, Savings: RM 1,500).
   - "Payroll In" one-tap action: Automatically credits all configured accounts in one transaction and logs the date.
4. **Category Manager**:
   - Add new custom categories with custom icons and color pickers; delete unused categories.
5. **AI Providers (BYOK)**:
   - Configure **Google Gemini** (API key, model picker: Flash / Pro).
   - Configure **DeepSeek** (API key, model picker: Chat / Reasoner).
   - Active provider selector radio.
   - Masked API key display with validation.

#### Target Redesign Layout
- **Bank Card Stacks**: Visually represent accounts with distinct card styling (debit card / e-wallet styling with logos and balance chips).
- **Payroll Flow Visualizer**: Interactive allocation slider or visual split pills showing salary distribution percentages.

---

### Screen 7: Fast Expense Entry Modal (`src/app/expenses/new.tsx`)

#### Purpose
Fast entry screen optimized to record an expense in **under 3 seconds**.

#### Functional Requirements
1. **POS-Style Money Input (`MoneyInput`)**:
   - Sen-first keypad entry: typing `1-2-5-0` instantly formats as `RM 12.50`.
   - Massive, centered typography with autofocus.
2. **Category Selection Grid**:
   - 2-row or 3-row horizontal grid of category chips with icons and colors.
   - Auto-remembers the last-used category for frictionless repeated logging.
3. **Account Selector with Projected Balance**:
   - Shows account chips with current balance and dynamically previews balance after deduction (e.g., `Maybank: RM 850 → RM 837.50`).
4. **Date Selection**:
   - Quick toggles: `Today`, `Yesterday`, or tap to open Calendar Sheet.
5. **Description / Note**:
   - Clean single-line input for optional remarks (max 200 chars).
6. **Linked Expense Read-Only Lock (`expenses/[id]/edit.tsx`)**:
   - If an expense was created by a commitment, editing or deleting is locked with a helpful explanation badge directing user to the Commitments tab.

---

## 4. Technical Stack, Component Architecture & Rules

### Core Libraries & Versions
- **Framework**: Expo SDK 57 (React Native 0.86.3, React 19.2.3, Expo Router v4).
- **Styling**: **NativeWind v4.2.7** (Tailwind CSS v3.4.19) + **React Native Reusables (RNR)** primitives.
- **Icons**: `@expo/vector-icons` (`Ionicons`) and `lucide-react-native`.
- **Database**: SQLite via `expo-sqlite` and `drizzle-orm`.
- **Forms**: `react-hook-form` with `zod` resolvers.
- **State Management**: `zustand` (stores in `src/store/`).

### Mandatory Component Rules
1. **Component Source**:
   - All core UI primitives must come from `@/components/ui/` (RNR primitives: `Button`, `Card`, `Input`, `Dialog`, `Select`, `Avatar`, `Badge`, `Chip`, `IconButton`, `Sheet`).
2. **Styling Paradigm**:
   - Use NativeWind `className` attributes for all styling. Avoid inline `style={{}}` except for dynamic runtime dimensions (e.g., dynamically computed progress widths or animated layout offsets).
3. **Borders vs Shadows**:
   - **Do not use heavy drop shadows** (`elevation`, `shadowOffset`, `shadowColor: #000`).
   - Use subtle hairline borders (`border border-border` or `border border-border/60`) and soft surface tinting for visual depth.
4. **Mobile Touch Affordances**:
   - Every interactive touch target (buttons, chips, inputs, list rows) **must meet the minimum 44px touch target** (`min-h-[44px]` or `min-h-[48px]`).
   - Respect Safe Areas using `react-native-safe-area-context`.
   - Modals and forms must use native bottom sheets (`Sheet`) or `KeyboardAwareScrollView` to ensure inputs are never obscured by the soft keyboard.
5. **Preserve Business Logic & Test Contracts**:
   - **DO NOT** modify the mathematical engine in `src/engine/` (`budgets.ts`, `cashflow.ts`, `commitments.ts`, `totals.ts`, `boundaries.ts`).
   - All existing `testID` attributes (e.g. `dashboard-screen`, `budget-overall-card`, `money-input`, `ai-analysis-card`) and accessibility labels **must be strictly preserved** so that the test suite continues to pass 100%.

---

## 5. Proposed New Design System Tokens (Color & Typography)

To replace the current dull aesthetic, use the following modern design tokens:

### Palette Specification: "Obsidian & Electric Mint" (Modern Fintech)

```css
/* Surface & Background */
--background: #090B10;         /* Deep void obsidian */
--card: #121620;               /* Elevated dark slate card */
--card-foreground: #F8FAFC;    /* Crisp primary text */
--popover: #161B27;            /* Dropdown / Sheet surface */
--popover-foreground: #F8FAFC;

/* Borders & Dividers */
--border: #21293A;             /* Hairline subtle border */
--border-subtle: #18202F;
--input: #1D2433;              /* Input field surface */

/* Brand & Accents */
--primary: #10B981;            /* Electric Mint / Emerald */
--primary-foreground: #022C22;
--secondary: #1E293B;          /* Charcoal chip surface */
--secondary-foreground: #94A3B8;

/* Functional States */
--destructive: #F43F5E;        /* Vibrant Rose Red (Over-budget / deficit) */
--destructive-foreground: #FFF;
--warning: #F59E0B;            /* Amber Glow (Bill due soon / budget warning) */
--warning-foreground: #FFF;
--muted: #1A2130;
--muted-foreground: #7C8BA1;   /* Secondary legible text */
--accent: #06B6D4;             /* Cyber Cyan highlight */
```

*(Note: If implementing a dual light/dark theme, map the light mode to Porcelain `#F8FAFC`, Crisp Card `#FFFFFF`, Hairline Border `#E2E8F0`, Text `#0F172A`, and Deep Emerald `#059669`).*

### Typography Scale
- **Display Amount**: `text-4xl` / `text-5xl font-black tracking-tight font-mono` (`fontVariant: ['tabular-nums']`).
- **Card Titles**: `text-xs font-bold uppercase tracking-wider text-muted-foreground`.
- **List Titles**: `text-base font-semibold text-foreground`.
- **Subtitles & Timestamps**: `text-xs font-medium text-muted-foreground`.

---

## 6. Execution Instructions for the AI Redesign Agent

When prompting another AI agent with this document, instruct it to execute the redesign in the following sequential phases:

1. **Phase 1: Design Tokens & Base Configuration**
   - Update `tailwind.config.js`, `global.css`, and `src/theme/colors.ts` with the new modern palette (obsidian/emerald or refined light theme).
   - Ensure hairline border variables and contrasting typography are declared.

2. **Phase 2: Core Primitives Polish (`src/components/ui/`)**
   - Refine `Card.tsx`, `Button.tsx`, `Badge.tsx`, `Chip.tsx`, `Input.tsx`, and `Sheet.tsx` to reflect the new visual style.
   - Verify minimum 44px touch targets on all interactive states.

3. **Phase 3: Screen-by-Screen Overhaul**
   - **Dashboard (`src/app/(tabs)/index.tsx`)**: Rebuild as an expressive Bento Grid with an electric Safe-to-Spend hero card and upcoming bill chips.
   - **Expenses (`src/app/(tabs)/expenses.tsx`)**: Implement modern search/filter header, elegant daily grouping, and refined transaction rows.
   - **Budgets (`src/app/(tabs)/budgets.tsx`)**: Modernize month navigation, circular/multi-stage progress meters, and category limit cards.
   - **Commitments (`src/app/(tabs)/commitments.tsx`)**: Redesign loans and subscriptions as sleek digital passes with clear due countdowns.
   - **Analytics (`src/app/(tabs)/analytics.tsx`)**: Enhance chart cards, stats grid, and the AI Financial Review card.
   - **Settings (`src/app/(tabs)/settings.tsx`)**: Redesign account cards as modern payment cards and streamline the payroll distribution view.
   - **Fast Entry (`src/app/expenses/new.tsx`)**: Optimize the POS money input and category grid for instant 3-second logging.

4. **Phase 4: Quality & Verification**
   - Run `npm run typecheck` to verify 0 TypeScript errors.
   - Run `npm run lint` to verify clean code standards.
   - Run `npm test` to guarantee that all 65 test suites and 800 tests continue to pass without a single regression.
   - Export and verify the build on a connected Android device.
