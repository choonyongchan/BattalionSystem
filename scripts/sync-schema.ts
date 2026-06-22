/**
 * Applies supabase/schema.sql to the unified hercules Supabase project.
 * Usage: bun run scripts/sync-schema.ts
 *
 * Requires SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL in .env.local.
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
if (!ACCESS_TOKEN) {
  console.error('Error: SUPABASE_ACCESS_TOKEN is not set.')
  process.exit(1)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!supabaseUrl) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL is not set.')
  process.exit(1)
}

const ref = new URL(supabaseUrl).hostname.split('.')[0]
const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'schema.sql')
const sql = readFileSync(schemaPath, 'utf-8')

process.stdout.write(`Syncing schema to project ${ref}... `)

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
  console.log('FAILED.')
  console.error(`HTTP ${res.status}: ${body}`)
  process.exit(1)
}

console.log('done.')
