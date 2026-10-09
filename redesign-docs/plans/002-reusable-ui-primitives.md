# 002 — Reusable UI Component Primitives

| | |
|---|---|
| **Status** | Ready for Session |
| **Version** | 1.0 |
| **Date** | 2026-10-06 |
| **Phase** | Phase 2: Primitives |
| **Dependencies** | 001 (Design Tokens & Theme Foundation) |
| **Source Specification** | `ui-redesign.pdf` (§ Reusable Component Primitives and Design System Architecture, pp. 7–12) |
| **Target Files** | `src/components/ui/MoneyDisplay.tsx`, `src/components/ui/StatusPill.tsx`, `src/components/ui/BudgetMeter.tsx`, `src/components/ui/BentoCard.tsx`, `src/components/ui/TouchTarget.tsx`, `src/components/ui/index.ts` |

---

## 1. Objective

Build and test the core atomic primitives in [`src/components/ui/`](file:///Users/ooiguancheng/Documents/projects/spending-tracker/src/components/ui/) that encapsulate the redesigned visual language: tabular numeric currency display, health status pills, dynamic budget meters, hairline Bento containers, and minimum 44–48px touch target wrappers.

---

## 2. Component Specifications

### 2.1 `MoneyDisplay.tsx`
Renders currency amounts with zero floating-point rounding errors from integer sen with Malaysian Ringgit (`RM`) formatting and fixed-width tabular monospace typography (`fontVariant: ['tabular-nums']`).

```tsx
interface MoneyDisplayProps extends TextProps {
  amountInSen: number;
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | 'hero';
  trendPrefix?: boolean; // Formats + / - prefix for income/expense deltas
  dimCents?: boolean;    // Dim the cents portion for visual hierarchy
  className?: string;
}
```
**Size Classes**:
- `xs`: `text-xs font-semibold`
- `sm`: `text-sm font-semibold`
- `base`: `text-base font-semibold`
- `lg`: `text-xl font-bold tracking-tight`
- `xl`: `text-2xl font-black tracking-tight`
- `hero`: `text-4xl sm:text-5xl font-black tracking-tighter`

### 2.2 `StatusPill.tsx`
Micro-badge container for cash flow health classifications and state indicators.

```tsx
export type StatusVariant = 'healthy' | 'warning' | 'danger' | 'neutral' | 'accent';

interface StatusPillProps {
  variant: StatusVariant;
  label: string;
  dot?: boolean;
  className?: string;
}
```
**Variant Styles**:
- `healthy`: `bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 dot:bg-emerald-500`
- `warning`: `bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 dot:bg-amber-500`
- `danger`: `bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-400 dot:bg-rose-500`
- `neutral`: `bg-slate-500/10 dark:bg-slate-500/15 border border-slate-500/30 text-slate-700 dark:text-slate-400 dot:bg-slate-400`
- `accent`: `bg-cyan-500/10 dark:bg-cyan-500/15 border border-cyan-500/30 text-cyan-700 dark:text-cyan-400 dot:bg-cyan-500`

### 2.3 `BudgetMeter.tsx`
Multi-stage dynamic progress indicator that shifts color across budget thresholds.

```tsx
interface BudgetMeterProps {
  spentSen: number;
  totalSen: number;
  customColor?: string;
  heightClass?: string; // Default: 'h-2'
}
```
**Threshold Physics**:
- `< 80%`: `bg-primary` (Electric Mint `#10B981`)
- `80% - 99%`: `bg-warning` (Warm Amber `#F59E0B`)
- `≥ 100%`: `bg-destructive` (Vivid Rose `#F43F5E`)

### 2.4 `BentoCard.tsx`
Modular surface container featuring hairline borders (`border border-border/60`), consistent elevation, and theme-aware surface fills.

```tsx
interface BentoCardProps extends ViewProps {
  elevated?: boolean;
  className?: string;
  children: React.ReactNode;
}
```
**Styling Rules**:
- Base: `bg-card rounded-2xl border border-border/60 p-4 overflow-hidden`
- Elevated: Subtle tonal shift / hairline emphasis for hero focus.

### 2.5 `TouchTarget.tsx`
Interactive wrapper enforcing minimum 44px to 48px touch boundaries in compliance with mobile touch accessibility requirements.

```tsx
interface TouchTargetProps extends PressableProps {
  minHeight?: number; // Default 44
  className?: string;
}
```

### 2.6 Core RNR Component Alignment
Review and refine existing primitives in `src/components/ui/` (`Button.tsx`, `Card.tsx`, `input.tsx`, `Sheet.tsx`) to ensure hairline framing (`border-border/60`) and proper touch targets without breaking backwards compatibility.

---

## 3. Invariants & Test Contracts

- **Integer Sen Arithmetic**: All calculations in `MoneyDisplay` and `BudgetMeter` operate strictly on sen integers.
- **Accessibility**: All interactive primitives must expose `accessibilityRole` and appropriate labels.
- **No Test Regressions**: Existing components utilizing `Card` or `Badge` must continue functioning properly.

---

## 4. Verification Commands

```bash
# 1. Typecheck
npm run typecheck

# 2. Linting
npm run lint

# 3. Component Unit Tests
npm test -- src/components/
```

---

## 5. Session Handoff Report Template

```markdown
### Session Handoff Report: Plan 002 — Reusable UI Component Primitives
- **Status**: [Completed / Blocked]
- **Files Created / Modified**:
  - `src/components/ui/MoneyDisplay.tsx`
  - `src/components/ui/StatusPill.tsx`
  - `src/components/ui/BudgetMeter.tsx`
  - `src/components/ui/BentoCard.tsx`
  - `src/components/ui/TouchTarget.tsx`
  - `src/components/ui/index.ts`
- **Verification Commands Executed**:
  - `npm run typecheck`: [PASS]
  - `npm run lint`: [PASS]
  - `npm test`: [PASS]
- **Handoff Notes**:
  - Primitives are ready for screen overhauls (Dashboard, Feed, Budgets, Commitments, Analytics, Settings, Fast Entry).
```
