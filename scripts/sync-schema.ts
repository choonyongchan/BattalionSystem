/**
 * Applies supabase/schema.sql to all active company Supabase projects.
 * Usage:
 *   bun run scripts/sync-schema.ts              # sync all companies
 *   bun run scripts/sync-schema.ts stallion     # sync specific companies
 *
 * Requires SUPABASE_ACCESS_TOKEN in .env.local (Supabase personal access token).
 * The token must have access to all target projects.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
if (!ACCESS_TOKEN) {
  console.error('Error: SUPABASE_ACCESS_TOKEN is not set in environment.')
  process.exit(1)
}

// Project refs for companies that have their own dedicated Supabase projects.
// Add new companies here as they are provisioned.
const PROJECT_REFS: Record<string, string> = {
  stallion: 'fscqxujtfewhjvphqtzw',
  hercules: 'qwlqamrvcosyewqxbrqx',
}

const targets = process.argv.slice(2)
const companies = targets.length > 0 ? targets : Object.keys(PROJECT_REFS)

const schemaPath = join(import.meta.dir, '..', 'supabase', 'schema.sql')
const sql = readFileSync(schemaPath, 'utf-8')

async function syncProject(company: string, ref: string) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body}`)
  }

  return res.json()
}

for (const company of companies) {
  const ref = PROJECT_REFS[company]
  if (!ref) {
    console.warn(`  [${company}] No project ref configured — skipping.`)
    continue
  }

  process.stdout.write(`  [${company}] Syncing schema... `)
  try {
    await syncProject(company, ref)
    console.log('done.')
  } catch (err) {
    console.log('FAILED.')
    console.error(`    ${err instanceof Error ? err.message : err}`)
    process.exitCode = 1
  }
}
