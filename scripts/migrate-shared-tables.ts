/**
 * One-off: copies the per-company tables ({Company}_Duty, ...) into the shared tables (Duty, ... with a
 * `company` column) made by supabase/schema.sql, then optionally drops the old ones.
 * Usage: bun run scripts/migrate-shared-tables.ts [--apply | --drop-old]
 *   default     dry run: row counts, old vs new; writes nothing
 *   --apply     empties the shared tables, copies every company in one transaction, checks the counts
 *               (re-run right before deploying the new code to pick up edits made since)
 *   --drop-old  drops the old per-company tables and their purge cron jobs; only if the counts match
 * Run `bun run scripts/backup-db.ts` and `bun run scripts/sync-schema.ts` first.
 *
 * Requires SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL in .env.local.
 */

import { COMPANIES, companyLabel } from '../shared/companies'

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!ACCESS_TOKEN || !supabaseUrl) {
  console.error('Error: SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL must be set.')
  process.exit(1)
}
const ref = new URL(supabaseUrl).hostname.split('.')[0]
const apply = process.argv.includes('--apply')
const dropOld = process.argv.includes('--drop-old')

async function query<T = Record<string, any>>(sql: string): Promise<T[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return (await res.json()) as T[]
}

const KINDS = ['NominalRoll', 'Exceptions', 'Duty', 'Settings', 'OffLeave', 'Conducts', 'ConductDecisions', 'MedicalReviews', 'OverviewMarks']
const SETTINGS_COLS = [
  'duty_base_weights', 'duty_day_multipliers', 'duty_weight_exceptions', 'eligibility_name_overrides', 'eligibility_rank_overrides',
  'guard_duty_rank_overrides', 'absence_scope_defaults', 'parade_times', 'platoons', 'extra_duty_types', 'multi_name_duty_types',
  'report_sick', 'conducts', 'overview', 'in_out_scopes',
]
const cols = (list: string[]) => list.map((c) => `"${c}"`).join(', ')

/** The INSERT ... SELECT statements that copy one company, in FK order. */
function copy(company: string): string {
  const L = companyLabel(company as never)
  const old = (kind: string) => `public."${L}_${kind}"`
  const co = `'${company}'`
  return `
INSERT INTO public."NominalRoll" (id, company, rank, name, platoon, four_d, on_strength, bunk)
  SELECT id, ${co}, rank, name, platoon, four_d, on_strength, bunk FROM ${old('NominalRoll')};
INSERT INTO public."Exceptions" (legacy_id, company, name, scope, reason, start, "end", counts_as_absence, time, location, in_out, soldier_id, type, revoked_at)
  SELECT id, ${co}, name, scope, reason, start, "end", counts_as_absence, time, location, in_out, soldier_id, type, revoked_at FROM ${old('Exceptions')} ORDER BY id;
INSERT INTO public."Duty" (company, duty_type, date, name) SELECT ${co}, duty_type, date, name FROM ${old('Duty')};
INSERT INTO public."OffLeave" (company, name, off, leave) SELECT ${co}, name, off, leave FROM ${old('OffLeave')};
INSERT INTO public."Settings" (company, ${cols(SETTINGS_COLS)})
  SELECT ${co}, ${cols(SETTINGS_COLS)} FROM ${old('Settings')};
INSERT INTO public."Conducts" (id, company, name, date, end_date, start_time, end_time, created_at)
  SELECT id, ${co}, name, date, end_date, start_time, end_time, created_at FROM ${old('Conducts')};
INSERT INTO public."ConductDecisions" (id, company, conduct_id, soldier_id, participating, reason, group_kind, created_at)
  SELECT id, ${co}, conduct_id, soldier_id, participating, reason, group_kind, created_at FROM ${old('ConductDecisions')};
INSERT INTO public."OverviewMarks" (company, date, key, kind) SELECT ${co}, date, key, kind FROM ${old('OverviewMarks')};
INSERT INTO public."MedicalReviews" (exception_id, company, nric, coy, last_ma, next_ma, memo, remarks)
  SELECT e.id, ${co}, m.nric, m.coy, m.last_ma, m.next_ma, m.memo, m.remarks
  FROM ${old('MedicalReviews')} m JOIN public."Exceptions" e ON e.company = ${co} AND e.legacy_id = m.exception_id;`
}

/** Row counts per company and kind: [old, shared]. One query, the API throttles many. */
async function counts() {
  const have = new Set((await query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)).map((r) => r.tablename))
  const parts = COMPANIES.flatMap((c) => KINDS.map((k) => {
    const o = `${companyLabel(c)}_${k}`
    return `SELECT '${c} ${k}' AS k, ${have.has(o) ? `(SELECT count(*) FROM public."${o}")` : 'NULL'} AS o, (SELECT count(*) FROM public."${k}" WHERE company = '${c}') AS n`
  }))
  const out: Record<string, [number | null, number]> = {}
  for (const r of await query(parts.join(' UNION ALL '))) out[r.k] = [r.o === null ? null : Number(r.o), Number(r.n)]
  return out
}
const mismatches = (c: Record<string, [number | null, number]>) => Object.entries(c).filter(([, [o, n]]) => o !== null && o !== n)

console.log(apply ? 'APPLYING' : dropOld ? 'DROPPING OLD TABLES' : 'DRY RUN', `- project ${ref}`)

if (apply) {
  await query(`BEGIN;
ALTER TABLE public."Exceptions" ADD COLUMN IF NOT EXISTS legacy_id bigint;
TRUNCATE public."MedicalReviews", public."ConductDecisions", public."OverviewMarks", public."Conducts", public."OffLeave", public."Duty", public."Exceptions", public."NominalRoll", public."Settings";
${COMPANIES.map(copy).join('\n')}
ALTER TABLE public."Exceptions" DROP COLUMN legacy_id;
COMMIT;`)
}

const c = await counts()
console.table(Object.fromEntries(Object.entries(c).filter(([, [o, n]]) => o || n).map(([k, [o, n]]) => [k, { old: o, shared: n }])))
const bad = mismatches(c)
if (apply || dropOld) console.log(bad.length ? `MISMATCH: ${bad.map(([k]) => k).join(', ')}` : 'Counts match.')

if (dropOld) {
  if (bad.length) { console.error('Refusing to drop: counts differ. Run --apply first.'); process.exit(1) }
  const sql = COMPANIES.flatMap((co) => [
    `SELECT cron.unschedule('purge-${companyLabel(co)}-exceptions') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-${companyLabel(co)}-exceptions');`,
    ...[...KINDS].reverse().map((k) => `DROP TABLE IF EXISTS public."${companyLabel(co)}_${k}";`),
  ])
  await query(`BEGIN;\n${sql.join('\n')}\nCOMMIT;`)
  console.log('Old per-company tables dropped.')
}
