import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/backend/data/client'
import { FIXTURE_SOLDIERS } from './soldiers'
import { FIXTURE_EXCEPTIONS } from './exceptions'
import { FIXTURE_DUTIES } from './duties'
import { RESET_SETTINGS } from './config'
import { FIXTURE_OFF_LEAVE } from './off-leave'

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
  const test = <T extends { eq: (col: string, v: string) => unknown }>(q: T) => q.eq('company', 'test')
  const ops = [
    test(db.from('Duty').delete()),
    // Decisions go with their conduct (ON DELETE CASCADE)
    test(db.from('Conducts').delete()),
    test(db.from('Exceptions').delete()),
    test(db.from('NominalRoll').delete()),
    test(db.from('OffLeave').delete()),
    // Only company = 'test' rows: the other companies share these tables, and PublicHolidays is battalion-wide live data
  ] as PromiseLike<{ error: { message: string } | null }>[]
  const results = await Promise.all(ops)
  const failed = results.find(r => r.error)
  if (failed?.error) throw new Error(`truncateTestDb failed: ${failed.error.message}`)
}

export async function seedTestDb() {
  const db = getClient()
  const test = <T extends object>(rows: T[]) => rows.map((r) => ({ ...r, company: 'test' }))
  const ops = await Promise.all([
    db.from('NominalRoll').insert(test(FIXTURE_SOLDIERS)),
    db.from('Exceptions').insert(test(FIXTURE_EXCEPTIONS)),
    db.from('Duty').insert(test(FIXTURE_DUTIES)),
    db.from('OffLeave').insert(test(FIXTURE_OFF_LEAVE)),
    db.from('Settings').update(RESET_SETTINGS).eq('company', 'test'),
  ])
  const failed = ops.find(r => r.error)
  if (failed?.error) throw new Error(`seedTestDb failed: ${failed.error.message}`)
}

/** Signs in as the test commander, then truncates and reseeds — for test files that mutate data. */
export async function resetTestDb() {
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_SUPABASE_EMAIL!,
    password: process.env.TEST_SUPABASE_PASSWORD!,
  })
  if (error) throw new Error(`resetTestDb sign-in failed: ${error.message}`)
  await truncateTestDb()
  await seedTestDb()
}
