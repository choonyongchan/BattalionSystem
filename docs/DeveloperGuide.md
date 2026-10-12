# Developer Guide

BattalionSystem is a company admin dashboard for 40SAR: bunk overview, parade state, report sick, nominal roll, off/leave, duty roster and conducts. It is a client-only Next.js 16 app built as a static export (`output: 'export'`), backed by one Supabase project.

## Setup

```bash
bun install
bun run dev          # http://localhost:3000
```

Put these in `.env.local`:

| Variable | Used by |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | app, tests |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | app, tests (publishable key only, never the service key) |
| `SUPABASE_ACCESS_TOKEN` | `scripts/sync-schema.ts` only. This is a personal token, so never prefix it with `NEXT_PUBLIC_`. |

For tests, `.env.test` also needs `TEST_SUPABASE_EMAIL` (`test@40sar.internal`) and `TEST_SUPABASE_PASSWORD`.

| Command | What it does |
|---|---|
| `bun run dev` | Dev server |
| `bun run build` | Static export to `out/` |
| `bun run type-check` | `tsc --noEmit` |
| `bun run test:unit` | Vitest, pure logic |
| `bun run test:integration` | Vitest, against the live `Test_*` tables |
| `npx playwright test` | e2e. On Windows Playwright hangs under bun, so run it with `npx`. |

## Architecture

```
app/        Next routes only. Thin: pick a company, render a frontend component.
frontend/   React UI: components, hooks, providers, theme.
backend/    Data access and business logic. No React.
shared/     Types and helpers used by both sides. Imports nothing internal.
tests/      unit/, integration/, e2e/, fixtures/
supabase/   schema.sql, the source of truth for the database
scripts/    sync-schema.ts
```

The layer rules keep the dependency graph one-way:

- `frontend` may import `backend` and `shared`.
- `backend` may import `shared` only.
- `shared` imports nothing internal.
- `app` imports `frontend` and `shared`.

Imports use the `@/` alias from the repo root, e.g. `@/backend/data/repositories/SoldierRepository`.

### Folder map

| Path | Contents |
|---|---|
| `app/page.tsx` | `/`: Hercules landing page when signed out, workspace when signed in |
| `app/settings/` | `/settings` for Hercules |
| `app/[company]/` | `/<company>/` and `/<company>/settings`. `company-param.ts` allowlists the param. |
| `frontend/components/layout/` | `CompanyShell` (auth gate and nav), `GlobalNav`, `TabBar`, `CompanyContent` (tabs and `?tab=`) |
| `frontend/components/<feature>/` | One folder per tab or feature: `overview`, `parade`, `report-sick`, `nominal-roll`, `off-leave`, `dashboard`, `conducts`, `soldier`, `settings`, `auth` |
| `frontend/components/ui/` | shadcn components (`components.json` points here) |
| `frontend/components/shared/` | Shared UI bits and style constants (`styles.ts`) |
| `frontend/hooks/` | `useAuth`, `useSettings`, `useParadeData`, `useConfirmDelete` |
| `frontend/theme.ts` | The single accent theme (Action Blue) |
| `backend/data/client.ts` | Supabase client and `tbl(company, table)` |
| `backend/data/auth.ts` | Commander sign-in |
| `backend/data/repositories/` | One class per table (see below) |
| `backend/domain/<feature>/` | Pure functions: bunk overview, parade report, strength, duty points, report sick, validation, bulk import |
| `shared/` | `types`, `companies`, `ranks`, `names`, `dates`, `utils` |

### Repositories

Each company table has a class that extends `CompanyRepository`. The constructor takes the company, so table names are never built by hand:

```ts
const soldiers = new SoldierRepository('hercules')
const { data, error } = await soldiers.list(true)
```

| Class | Table |
|---|---|
| `SoldierRepository` | `{Company}_NominalRoll` |
| `ExceptionRepository` | `{Company}_Exceptions` |
| `DutyRepository` | `{Company}_Duty` |
| `StrengthOverrideRepository` | `{Company}_StrengthOverride` |
| `OffLeaveRepository` | `{Company}_OffLeave` |
| `ConductRepository` | `{Company}_Conducts` and `_ConductDecisions` |
| `MedicalReviewRepository` | `{Company}_MedicalReviews` (NRIC and appointments for a 'Medical Review' exception; deleted with it) |
| `SettingsRepository` | `{Company}_Settings` (validated with zod) |
| `PublicHolidayRepository` | `PublicHolidays` (shared by all companies) |

Components never call `supabase.from(...)` directly. Add a repository method instead.

Classes are used only for these stateful units. Domain logic stays as plain functions, so it can be unit-tested without a database.

## Data model and security

`supabase/schema.sql` creates the per-company tables in a loop over the company names. Every table has row-level security (RLS) with one policy:

```sql
USING (auth.email() = '<company>@40sar.internal')
```

Each company has one commander account, e.g. `hercules@40sar.internal`. A signed-in commander can only read and write their own company's tables. The publishable key in the browser gives no access without that sign-in.

`PublicHolidays` is battalion-wide, so any signed-in account can edit it.

The login lockout (3 tries, then 30 s) runs only in the browser. The real brute-force protection is Supabase's auth rate limit.

### Changing the schema

1. Edit `supabase/schema.sql`. Keep it re-runnable (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).
2. Run `bun run scripts/sync-schema.ts`. This applies the whole file to the live project.
3. Add new columns to `shared/types.ts` and the matching repository.

The sync re-runs the whole file on live data, so `schema.sql` must change structure only. Never put an `UPDATE` or `DELETE` of existing rows in it. Do one-off data fixes by hand after checking which rows they touch, and back up first (put backups in `backups/`, which is gitignored). The sync never drops anything either: remove tables or columns by hand.

## Companies

`shared/companies.ts` controls which companies are live:

| Constant | Meaning |
|---|---|
| `COMPANIES` | Every company with tables. Route params must be in this list. |
| `PRIMARY_COMPANY` | `hercules`. Served at `/` instead of `/hercules/`. |
| `DISABLED_COMPANIES` | archer, braves, cougar, stallion. Their pages show "Not available yet". Their data is kept. |
| `HIDDEN_COMPANIES` | `test`. Works at `/test/` for tests but is not listed anywhere. |
| `PARADE_CONFIG` | Per-company platoons and duty types shown on the parade state. |

To **re-enable a company**, remove it from `DISABLED_COMPANIES`. It then works at `/<company>/`. Its tables and auth user already exist.

To **add a new company**:

1. Add its name to `COMPANIES`.
2. Add it to the company loop in `supabase/schema.sql` and run the sync.
3. Create the auth user `<company>@40sar.internal` in the Supabase dashboard.

## Adding a tab

1. Build the component in `frontend/components/<feature>/`. It takes `{ company }` and loads data through a repository.
2. Add an id to `TabId` and an entry to `TAB_GROUPS` in `frontend/components/layout/TabBar.tsx`.
3. Render it for that id in `frontend/components/layout/CompanyContent.tsx`.

The tab bar, keyboard navigation and `?tab=<id>` deep links then work with no other changes.

## UI

Styling follows `DESIGN.md`. Tokens live in `app/globals.css` under `@theme`. Use them as Tailwind classes (`bg-action`, `text-ink-60`, `bg-parchment`, `border-hairline`, `rounded-card`) rather than raw hex values.

- The only accent is Action Blue (`action`). Red (`danger`), amber and green are for status only.
- Body text is 17px. Tables stay at 14px.
- Use `text-ink-60` for secondary text. `ink-48` fails WCAG AA contrast for text.
- No shadows. Cards use a hairline border and an 18px radius.

## Testing

| Layer | Where | Runs against |
|---|---|---|
| Unit | `tests/unit/` | Pure functions from `backend/domain` and `shared`. No mocks, no network. |
| Integration | `tests/integration/` | Repositories, hooks and components against the live `Test_*` tables |
| e2e | `tests/e2e/` | The real app in Chromium, signed in as `test@` |

Integration and e2e tests share the live `Test_*` tables. So:

- Vitest runs files one at a time (`fileParallelism: false`), and Playwright uses one worker.
- Call `resetTestDb()` from `tests/fixtures/db.ts` before a test that depends on exact data. It signs in, empties the `Test_*` tables and loads the fixtures.
- The fixtures in `tests/fixtures/` are dummy soldiers, exceptions, duties and off/leave, dated around `FIXTURE_DATE` (2026-01-15). e2e tests fix the browser clock to that date.
- Never touch non-`Test_` tables in a test. `PublicHolidays` is real data, and a reset leaves it alone.

Mock only what the test can't reach for real, e.g. `next/navigation`.

## Deploy

The app is a static export, deployed on Vercel. `bun run build` writes `out/`. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the Vercel project. No server-side secrets are needed at runtime.
