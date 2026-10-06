# 008 — Settings, Accounts & Payroll Screen Redesign

| | |
|---|---|
| **Status** | Ready for Session |
| **Version** | 1.0 |
| **Date** | 2026-10-06 |
| **Phase** | Phase 3: Screen Overhaul (Screen 6) |
| **Dependencies** | 001 (Tokens), 002 (Primitives) |
| **Source Specification** | `ui-redesign.pdf` (§ Screen 6: Settings, Accounts, and Payroll, pp. 17–18) |
| **Target Files** | `src/app/(tabs)/settings.tsx`, `src/components/AccountRow.tsx`, `src/components/AccountModal.tsx` |

---

## 1. Objective

Overhaul the Settings screen into an intuitive operations control centre. Present connected accounts as **stacked physical payment cards** with clear distinction between liquid capital and revolving credit debt; transform payroll distribution into an interactive **Standing Payroll Split Visualizer**; and streamline the Bring-Your-Own-Key (BYOK) **AI Provider Manager** with model discovery and encrypted key management.

---

## 2. Layout & Architectural Specifications

```
┌────────────────────────────────────────────────────────┐
│  CONNECTED ACCOUNTS STACK (testID="accounts-stack")    │
│  ┌─ 💳 Maybank Savings ─────────────── Checking ─────┐ │
│  │ Available Balance: RM 4,850.00                    │ │
│  │ [Tonal Hairline Border • Tap to Adjust]           │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ 💳 Touch 'n Go eWallet ──────────── eWallet ──────┤ │
│  │ Available Balance: RM 340.20                      │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ 💳 Maybank Visa Platinum ────────── Revolving CC ─┤ │
│  │ Outstanding Debt (OWED): -RM 1,200.00 (Vivid Rose)│ │
│  └───────────────────────────────────────────────────┘ │
│  [ + Add Account ]                                     │
├────────────────────────────────────────────────────────┤
│  STANDING PAYROLL ALLOCATION ENGINE                    │
│  Salary: RM 5,000.00                                   │
│  [ Maybank: 60% (RM 3k) ] [ TnG: 10% ] [ Savings: 30% ]│
│  [ ⚡ Payroll In (testID="trigger-payroll-btn") ]      │
├────────────────────────────────────────────────────────┤
│  AI PROVIDER CONFIGURATION (testID="ai-config-section")│
│  ◉ Google Gemini (Flash / Pro)                         │
│  ○ DeepSeek (Chat / Reasoner)                          │
│  [ Secure Key Input: •••••••••••••••• ]  [ Test Key ]  │
│  Status: Active & Validated                            │
└────────────────────────────────────────────────────────┘
```

### 2.1 Connected Accounts Stack
- Rendered using stacked payment cards (`BentoCard`), tagged with `testID="accounts-stack"` (retaining `settings-accounts-list`).
- **Liquid Accounts** (Cash, Checking, Savings):
  - Formatted positive balances via `MoneyDisplay` with Electric Mint accents.
- **Revolving Credit Accounts**:
  - Clear red badge and negative typography indicating debt (`OWED: -RM 1,200.00`).
- Tapping an account opens a balance adjustment modal that creates an audit entry for tracking corrections.

### 2.2 Standing Payroll Allocation Engine
- Split visualizer with interactive percentage pills displaying target account distribution (e.g., Maybank: RM 3,000, Touch 'n Go: RM 500, Savings: RM 1,500).
- Action trigger: **"Payroll In"** (`testID="trigger-payroll-btn"` / `payroll-in-button`).
- Single-transaction multi-account crediting with timestamp logging in SQLite.

### 2.3 AI Provider Manager (BYOK)
- Enclosed in `testID="ai-config-section"`.
- Clean radio options to toggle between **Google Gemini** (Flash / Pro) and **DeepSeek** (Chat / Reasoner).
- Secure key input with inline validation and storage in on-device encrypted SecureStore.

---

## 3. Preserved Test Contracts & IDs

| Element | Preserved `testID` | Additional Retained IDs |
|---|---|---|
| Connected Accounts Stack | `testID="accounts-stack"` | `settings-accounts-list`, `add-account-button`, `accounts-error` |
| Payroll Action Trigger | `testID="trigger-payroll-btn"` | `payroll-in-button`, `payroll-total`, `payroll-empty`, `payroll-last-run` |
| AI Config Section | `testID="ai-config-section"` | `settings-ai-status-gemini`, `settings-ai-status-deepseek` |
| Screen Container | `testID="settings-screen"` | — |
| User Profile & Auth | `testID="settings-email"` | `settings-logout` |
| Payroll Allocations | `testID="payroll-add-allocation"` | `payroll-line-{id}`, `payroll-line-edit-{id}`, `payroll-line-remove-{id}` |
| Buffer Settings | `testID="settings-buffer-current"` | `settings-buffer-input`, `settings-buffer-save`, `settings-buffer-error` |
| Category Management | `testID="settings-categories-add"` | `settings-category-{id}`, `settings-categories-delete`, `settings-categories-exit` |

---

## 4. Invariants & Guardrails

- **Zero arithmetic on screen**: Payroll allocations and account balances derive directly from services (`AccountService`, `SettingsService`).
- **SecureStore Secrets**: API keys remain strictly on device; never written to SQLite, logs, or telemetry.
- **Credit Card Balance Invariant**: Stored as positive integer sen (`balance_sen`), rendered as debt when `is_credit = true`.

---

## 5. Verification Commands

```bash
# 1. Typecheck
npm run typecheck

# 2. Lint
npm run lint

# 3. Jest tests for Settings and Accounts
npm test -- src/app/__tests__/settings src/services/__tests__/settings src/repositories/drizzle/__tests__/account
```

---

## 6. Session Handoff Report Template

```markdown
### Session Handoff Report: Plan 008 — Settings, Accounts & Payroll Screen Redesign
- **Status**: [Completed / Blocked]
- **Files Modified**:
  - `src/app/(tabs)/settings.tsx`
  - `src/components/AccountRow.tsx`
  - `src/components/AccountModal.tsx`
- **Preserved Test Contracts Verified**:
  - [x] testID="accounts-stack"
  - [x] testID="trigger-payroll-btn"
  - [x] testID="ai-config-section"
- **Verification Commands Executed**:
  - `npm run typecheck`: [PASS]
  - `npm test`: [PASS]
- **Handoff Notes**:
  - Payment card visual hierarchy and standing payroll visualizer operational.
```
