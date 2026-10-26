/**
 * Dumps every public table (rows as JSON) plus the cron jobs to backups/<timestamp>/.
 * Usage: bun run scripts/backup-db.ts
 *
 * Requires SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL in .env.local.
 */

import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!ACCESS_TOKEN || !supabaseUrl) {
  console.error('Error: SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL must be set.')
  process.exit(1)
}
const ref = new URL(supabaseUrl).hostname.split('.')[0]

async function query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return (await res.json()) as T[]
}

const dir = join('backups', new Date().toISOString().replace(/[:.]/g, '-'))
mkdirSync(dir, { recursive: true })

const tables = await query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`)
const counts: Record<string, number> = {}
for (const { tablename } of tables) {
  const data = await query(`SELECT * FROM public."${tablename}"`)
  writeFileSync(join(dir, `${tablename}.json`), JSON.stringify(data, null, 1))
  counts[tablename] = data.length
}
writeFileSync(join(dir, '_cron.json'), JSON.stringify(await query(`SELECT jobname, schedule, command FROM cron.job`), null, 1))
writeFileSync(join(dir, '_counts.json'), JSON.stringify(counts, null, 1))
console.log(`Backed up ${tables.length} tables of project ${ref} to ${dir}`)
console.table(counts)
