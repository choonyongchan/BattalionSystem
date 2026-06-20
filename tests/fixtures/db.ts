import { createClient } from '@supabase/supabase-js'
import { FIXTURE_SOLDIERS } from './soldiers'
import { FIXTURE_EXCEPTIONS } from './exceptions'
import { FIXTURE_DUTIES } from './duties'
import { FIXTURE_CONFIG } from './config'

function serviceClient() {
  const url = process.env.TEST_SUPABASE_URL
  const key = process.env.TEST_SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_KEY must be set in .env.test')
  return createClient(url, key)
}

export async function truncateTestDb() {
  const db = serviceClient()
  await db.from('Duty').delete().like('name', 'TEST_%')
  await db.from('Exceptions').delete().like('name', 'TEST_%')
  await db.from('NominalRoll').delete().like('name', 'TEST_%')
  await db.from('Configuration').delete().in('parade_type', ['First Parade', 'Last Parade'])
}

export async function seedTestDb() {
  const db = serviceClient()
  await db.from('NominalRoll').insert(FIXTURE_SOLDIERS)
  await db.from('Exceptions').insert(FIXTURE_EXCEPTIONS)
  await db.from('Duty').insert(FIXTURE_DUTIES)
  await db.from('Configuration').upsert(FIXTURE_CONFIG)
}
