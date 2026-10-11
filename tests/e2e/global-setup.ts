import dotenv from 'dotenv'
dotenv.config({ path: '.env.test' })

import { supabase } from '@/backend/data/client'
import { truncateTestDb, seedTestDb } from '@/tests/fixtures/db'

export default async function globalSetup() {
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_SUPABASE_EMAIL!,
    password: process.env.TEST_SUPABASE_PASSWORD!,
  })
  if (error) throw new Error(`E2E setup sign-in failed: ${error.message}`)

  await truncateTestDb()
  await seedTestDb()
}
