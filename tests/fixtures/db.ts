import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { FIXTURE_SOLDIERS } from './soldiers'
import { FIXTURE_EXCEPTIONS } from './exceptions'
import { FIXTURE_DUTIES } from './duties'
import { FIXTURE_CONFIG } from './config'

// Use service key if it looks real; otherwise fall back to the authenticated singleton
// (integration tests call truncate/seed AFTER signInWithPassword, so the singleton works)
function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.TEST_SUPABASE_SERVICE_KEY ?? ''
  if (key && !key.startsWith('<')) return createClient(url, key)
  return supabase
}

export async function truncateTestDb() {
  const db = getClient()
  const ops = [
    db.from('Test_Duty').delete().gte('date', '2000-01-01'),
    db.from('Test_Exceptions').delete().gte('id', 0),
    db.from('Test_NominalRoll').delete().neq('name', ''),
    db.from('Test_Configuration').delete().in('parade_type', ['First Parade', 'Last Parade']),
  ]
  const results = await Promise.all(ops)
  const failed = results.find(r => r.error)
  if (failed?.error) throw new Error(`truncateTestDb failed: ${failed.error.message}`)
}

export async function seedTestDb() {
  const db = getClient()
  const ops = await Promise.all([
    db.from('Test_NominalRoll').insert(FIXTURE_SOLDIERS),
    db.from('Test_Exceptions').insert(FIXTURE_EXCEPTIONS),
    db.from('Test_Duty').insert(FIXTURE_DUTIES),
    db.from('Test_Configuration').upsert(FIXTURE_CONFIG),
  ])
  const failed = ops.find(r => r.error)
  if (failed?.error) throw new Error(`seedTestDb failed: ${failed.error.message}`)
}
