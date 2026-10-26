/**
 * One-off: moves Guard Duty exceptions into the Duty table as role duties (CDOS, GC, G2, RG1-RG6).
 * Usage: bun run scripts/migrate-guard-duty.ts [--apply] [--all]
 *   default   dry run: prints the plan, writes nothing
 *   --apply   upserts the Duty rows and deletes the migrated exceptions (one transaction per company)
 *   --all     also migrates past rows (default: end date today or later)
 * Rows that cannot be mapped cleanly (unknown role, role already taken that day, more than 6 RG) are
 * listed and left in Exceptions untouched. Revoked rows are ignored.
 *
 * Requires SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL in .env.local.
 */

import { COMPANIES, companyLabel, type Company } from '../shared/companies'
import { todaySGDate } from '../shared/dates'

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!ACCESS_TOKEN || !supabaseUrl) {
  console.error('Error: SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL must be set.')
  process.exit(1)
}
const apply = process.argv.includes('--apply')
const includePast = process.argv.includes('--all')
const ref = new URL(supabaseUrl).hostname.split('.')[0]

const RG = ['RG1', 'RG2', 'RG3', 'RG4', 'RG5', 'RG6']
/** Old exception reason -> new duty role; 'Regimental Guard' takes the next free RG slot. */
const ROLE_OF: Record<string, string> = { cdos: 'CDOS', 'guard comd': 'GC', 'guard 2ic': 'G2' }

async function query<T = unknown>(sql: string): Promise<T[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return (await res.json()) as T[]
}
const lit = (v: string) => `'${v.replace(/'/g, "''")}'`

interface Row { id: number; name: string; reason: string | null; start: string | null; end: string | null }

async function migrate(company: Company) {
  const ex = `public."${companyLabel(company)}_Exceptions"`
  const duty = `public."${companyLabel(company)}_Duty"`
  const where = `scope = 'Guard Duty' AND revoked_at IS NULL${includePast ? '' : ` AND coalesce("end", start) >= ${lit(todaySGDate())}`}`
  const rows = await query<Row>(`SELECT id, name, reason, start::text, "end"::text FROM ${ex} WHERE ${where} ORDER BY coalesce("end", start), id`)
  if (!rows.length) return console.log(`${company}: nothing to migrate`)

  const taken = new Set((await query<{ duty_type: string; date: string }>(
    `SELECT duty_type, date::text FROM ${duty} WHERE duty_type IN (${['CDOS', 'GC', 'G2', ...RG].map(lit).join(',')})`,
  )).map((d) => `${d.duty_type}|${d.date}`))

  const moves: { id: number; role: string; date: string; name: string }[] = []
  const problems: string[] = []
  for (const r of rows) {
    const date = r.end ?? r.start
    const label = `#${r.id} ${r.name} ${date} "${r.reason ?? ''}"`
    if (!date) { problems.push(`${label}: no date`); continue }
    const key = (r.reason ?? '').trim().toLowerCase()
    const role = ROLE_OF[key] ?? (key === 'regimental guard' ? RG.find((s) => !taken.has(`${s}|${date}`)) : undefined)
    if (!role) { problems.push(`${label}: ${key === 'regimental guard' ? 'all 6 RG slots taken' : 'unknown role'}`); continue }
    if (taken.has(`${role}|${date}`)) { problems.push(`${label}: ${role} already taken that day`); continue }
    taken.add(`${role}|${date}`)
    moves.push({ id: r.id, role, date, name: r.name.toUpperCase() })
  }

  console.log(`${company}: ${moves.length} to move, ${problems.length} need attention`)
  for (const m of moves) console.log(`  #${m.id} -> ${m.role} ${m.date} ${m.name}`)
  for (const p of problems) console.log(`  SKIP ${p}`)
  if (!apply || !moves.length) return

  await query(`BEGIN;
INSERT INTO ${duty} (duty_type, date, name) VALUES ${moves.map((m) => `(${lit(m.role)}, ${lit(m.date)}, ${lit(m.name)})`).join(', ')};
DELETE FROM ${ex} WHERE id IN (${moves.map((m) => m.id).join(',')});
COMMIT;`)
  console.log(`  applied`)
}

console.log(apply ? 'APPLYING' : 'DRY RUN (add --apply to write)', `- project ${ref}`)
for (const company of COMPANIES) await migrate(company)
