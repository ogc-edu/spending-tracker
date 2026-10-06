# 001 — Design Tokens, Surface Optics & Typography Foundation

| | |
|---|---|
| **Status** | Ready for Session |
| **Version** | 1.0 |
| **Date** | 2026-10-06 |
| **Phase** | Phase 1: Token Setup |
| **Dependencies** | None (Base styling setup) |
| **Source Specification** | `ui-redesign.pdf` (§ Design Tokens, Surface Optics, and Typography System) |
| **Target Files** | `tailwind.config.js`, `global.css`, `src/theme/colors.ts`, `src/theme/typography.ts`, `src/theme/index.ts` |

---

## 1. Objective

Establish the foundational design tokens, color spectrum, hairline framing system, and typography scale specified in the UI redesign blueprint. Deliver support for **Obsidian Luxe** (Dark / OLED-optimized) and **Swiss Porcelain** (Light) palettes, hairlineWidth borders, and tabular monospace font styling for numeric data across the entire application.

---

## 2. Context & Design System Specifications

The application is upgrading from a standard off-white (`#F7F8FA`) and corporate green (`#15803D`) theme with heavy drop shadows to an **Obsidian Luxe & Electric Mint** design system. Depth is established through tonal separation and hairline borders (`border border-border/60`, 0.5pt equivalent) instead of heavy artificial shadows.

### 2.1 Color Token Architecture
Tokens must be defined via CSS variables in `global.css` and mapped in `tailwind.config.js` and `src/theme/colors.ts`.

| Design Token | Obsidian Palette (Dark) | Porcelain Palette (Light) | Architectural Function |
|---|---|---|---|
| `--background` | `#090B10` | `#F8FAFC` | Canvas foundation establishing maximum OLED contrast |
| `--card` | `#121620` | `#FFFFFF` | Primary Bento Grid tile surface |
| `--card-foreground` | `#F8FAFC` | `#0F172A` | High-contrast text and numerical values |
| `--border` | `#21293A` | `#E2E8F0` | Structural hairline framing (0.5 pt equivalent) |
| `--border-subtle` | `#18202F` | `#F1F5F9` | Internal dividers between related metrics |
| `--input` | `#1D2433` | `#F1F5F9` | Background surface for text entry and keypad targets |
| `--primary` | `#10B981` | `#059669` | Electric Mint; indicates healthy cash flow and positive balances |
| `--primary-foreground` | `#022C22` | `#FFFFFF` | Contrast text for primary buttons and chips |
| `--destructive` | `#F43F5E` | `#E11D48` | Vivid Rose; highlights deficits and budget overruns |
| `--warning` | `#F59E0B` | `#D97706` | Warm Amber; denotes approaching bills and budget limits |
| `--muted` | `#1A2130` | `#F1F5F9` | Recessed backgrounds for chips and meter tracks |
| `--muted-foreground` | `#7C8BA1` | `#64748B` | Secondary labels and timestamp indicators |
| `--accent` | `#06B6D4` | `#0891B2` | Cyber Cyan; marks linked commitments and AI evaluations |

### 2.2 Typography Scale
- **Display / Hero Numbers**: `text-5xl font-black font-mono tracking-tighter` with `fontVariant: ['tabular-nums']`
- **Card Titles & Section Headers**: `text-[11px] font-bold uppercase tracking-wider text-muted-foreground`
- **Standard Body**: `text-base font-semibold text-foreground`
- **Metadata & Captions**: `text-xs font-medium text-muted-foreground`
- **Tabular Figures**: All currency and numerical metrics must specify tabular numbers to prevent layout shift during updates.

---

## 3. Technical Requirements

1. **`tailwind.config.js`**:
   - Configure extended colors to resolve to CSS variables (`background`, `card`, `popover`, `border`, `input`, `primary`, `secondary`, `destructive`, `warning`, `muted`, `accent`).
   - Include `subtle` under `border` (`var(--border-subtle)`).
   - Ensure `hairlineWidth()` from `nativewind/theme` is available as `border-hairline`.
   - Configure font families:
     - `mono`: `['SpaceMono', 'Courier New', 'monospace']`
     - `sans`: `['Inter', 'system-ui', 'sans-serif']`

2. **`global.css`**:
   - Provide `:root` (Porcelain Swiss theme) and `.dark` (Obsidian Luxe theme) variable declarations.
   - Support dark mode class resolution.

3. **`src/theme/colors.ts` & `src/theme/typography.ts`**:
   - Update TypeScript color constants to export Obsidian and Porcelain tokens while maintaining backward compatibility for existing consumers that read `colors.accent`, `colors.danger`, etc.
   - Ensure existing token contrast assertions in `src/theme/__tests__/tokens.test.ts` pass or are updated to reflect the new tokens with WCAG AA compliance.

---

## 4. Invariants to Preserve

- **Do NOT break TypeScript typechecking**: `src/theme/colors.ts` must maintain compatible exports.
- **Do NOT touch domain logic**: No changes to `src/engine/*` or database schemas.
- **WCAG AA Contrast**: Ensure all text/background combinations meet or exceed 4.5:1 contrast ratio.

---

## 5. Verification Commands

```bash
# 1. Typecheck
npm run typecheck

# 2. Linting
npm run lint

# 3. Unit tests for tokens and theme
npx jest src/theme/__tests__/tokens.test.ts
```

---

## 6. Session Handoff Report Template

```markdown
### Session Handoff Report: Plan 001 — Design Tokens & Theme Foundation
- **Status**: [Completed / Blocked]
- **Files Modified**:
  - `tailwind.config.js`
  - `global.css`
  - `src/theme/colors.ts`
  - `src/theme/typography.ts`
- **Verification Commands Executed**:
  - `npm run typecheck`: [PASS]
  - `npm run lint`: [PASS]
  - `npx jest src/theme/__tests__/tokens.test.ts`: [PASS]
- **Handoff Notes**:
  - Tailwind tokens and CSS variables are ready for Phase 2 Primitives.
```
