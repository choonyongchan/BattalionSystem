# Unified Supabase Project Design

**Date:** 2026-06-21  
**Status:** Approved

## Problem

The system currently uses one Supabase project per company (up to 5 projects). This means 5 separate sets of credentials, 5 separate schema sync targets, and 5 separate auth user pools. Only stallion and hercules are active; archer, braves, and cougar have empty env vars.

## Goal

Consolidate all companies into the existing **hercules** Supabase project. Each company gets its own prefixed table group: `{Company}_NominalRoll`, `{Company}_Exceptions`, `{Company}_Duty`, `{Company}_Configuration` (company name is capitalised, e.g. `Archer_`, `Stallion_`).

A `Test` company (outside the `COMPANIES` array) gets its own `Test_*` tables for integration and E2E testing.

---

## Schema (`supabase/schema.sql`)

### Table naming

For each company in `['Archer', 'Braves', 'Cougar', 'Stallion', 'Hercules']` plus `Test`, create 4 tables:

- `{Company}_NominalRoll` — same columns as current `NominalRoll`
- `{Company}_Exceptions` — same columns as current `Exceptions`
- `{Company}_Duty` — same columns as current `Duty`
- `{Company}_Configuration` — same columns as current `Configuration`

Total: 24 tables (6 × 4).

Use a PL/pgSQL `DO` block with a `FOREACH` loop to create all tables, grants, RLS, and seed rows without repetition.

### RLS policy per company

```sql
USING (auth.email() = lower('{company}') || '@40sar.internal')
```

Every `{Company}_*` table has two policies: read and write for authenticated users whose email matches that company's login.

### Configuration seed

Each `{Company}_Configuration` gets the default parade times seeded with `ON CONFLICT DO NOTHING`.

### Idempotency

The schema remains safe to re-run: all `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`, and `ON CONFLICT DO NOTHING`.

---

## `lib/supabase.ts`

### Single client

`SUPABASE_CONFIGS` collapses to one entry. `getSupabaseClient(company)` ignores its argument and always returns the same hercules client. The `company` parameter is kept so all call sites remain unchanged.

### TypeScript `Database` type

Use mapped types to generate the 20 company table entries automatically, plus 4 explicit `Test_*` entries:

```typescript
type CompanyTables =
  { [C in Company as `${Capitalize<C>}_NominalRoll`]:   NominalRollTable } &
  { [C in Company as `${Capitalize<C>}_Exceptions`]:    ExceptionsTable  } &
  { [C in Company as `${Capitalize<C>}_Duty`]:          DutyTable        } &
  { [C in Company as `${Capitalize<C>}_Configuration`]: ConfigTable      }

type TestTables = {
  Test_NominalRoll:   NominalRollTable
  Test_Exceptions:    ExceptionsTable
  Test_Duty:          DutyTable
  Test_Configuration: ConfigTable
}

type Database = { public: { Tables: CompanyTables & TestTables; Views: ...; Functions: ... } }
```

### Table name helper

```typescript
export const tbl = (company: Company, table: string) =>
  `${companyLabel(company)}_${table}` as const
```

`companyLabel` already capitalises the first letter, so no new logic is needed.

`tbl` is typed for `Company` only. Test fixtures use the service-key client directly and reference table names as plain strings (e.g. `'Test_NominalRoll'`), so they do not use `tbl`.

---

## Component call sites

All `.from('NominalRoll')` calls in `NominalRoll.tsx` and `ParadeState.tsx` change to `.from(tbl(company, 'NominalRoll'))`. Same pattern for `Exceptions`, `Duty`, and `Configuration`. No other component logic changes.

---

## Environment variables

### `.env.local` (before → after)

**Remove:**
```
NEXT_PUBLIC_ARCHER_SUPABASE_URL
NEXT_PUBLIC_ARCHER_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_BRAVES_SUPABASE_URL
NEXT_PUBLIC_BRAVES_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_COUGAR_SUPABASE_URL
NEXT_PUBLIC_COUGAR_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_STALLION_SUPABASE_URL
NEXT_PUBLIC_STALLION_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_HERCULES_SUPABASE_URL
NEXT_PUBLIC_HERCULES_SUPABASE_PUBLISHABLE_KEY
```

**Keep/rename to:**
```
NEXT_PUBLIC_SUPABASE_URL=https://jwvsxvasusnznskmywwl.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<hercules anon key>
SUPABASE_ACCESS_TOKEN=<personal access token>
```

### `.env.test` (before → after)

**Replace entirely with:**
```
NEXT_PUBLIC_SUPABASE_URL=https://jwvsxvasusnznskmywwl.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<hercules anon key>
TEST_SUPABASE_SERVICE_KEY=<hercules service role key>
TEST_SUPABASE_EMAIL=test@40sar.internal
TEST_SUPABASE_PASSWORD=<test user password>
```

---

## `scripts/sync-schema.ts`

Remove the per-company loop. The script reads a single project ref from `NEXT_PUBLIC_SUPABASE_URL` and syncs to hercules only. The `PROJECT_REFS` map and argv company-filtering logic go away.

---

## Data migration (manual, one-time)

Done in the Supabase dashboard before cutting over:

1. **Auth users** — create `stallion@40sar.internal` in hercules auth (hercules user already exists). Create `test@40sar.internal` for testing. Create `archer@40sar.internal`, `braves@40sar.internal`, `cougar@40sar.internal` when those companies are enabled.
2. **Stallion data** — export each table from the stallion Supabase project (CSV), import into the corresponding `Stallion_*` tables in hercules.
3. **Hercules data** — existing rows in hercules `NominalRoll` etc. are copied into `Hercules_NominalRoll` etc. The old unprefixed tables can be dropped after verification.

---

## Test setup changes

Tests currently target `stallion` company against a separate Supabase project. After this change:

- Company under test changes from `'stallion'` to `'test'`
- Fixture helpers use `Test_*` table names
- Auth uses `test@40sar.internal`
- `.env.test` points at hercules (same project as production — Test tables are isolated by RLS)

---

## What is NOT changing

- `lib/companies.ts` — `COMPANIES`, `DISABLED_COMPANIES`, `COMPANY_THEMES`, `companyLabel` are unchanged
- `lib/useAuth.ts` — login logic is unchanged; `{company}@40sar.internal` convention stays
- `app/` pages — no changes
- `components/CompanyContent.tsx`, `CommanderLoginForm.tsx` — no changes
