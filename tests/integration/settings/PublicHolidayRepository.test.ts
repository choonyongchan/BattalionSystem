import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { supabase } from '@/backend/data/client'
import { PublicHolidayRepository } from '@/backend/data/repositories/PublicHolidayRepository'
import { truncateTestDb } from '@/tests/fixtures/db'

// PublicHolidays is battalion-wide and shared with live data, so these tests only
// ever touch their own far-future dates.
const KEEP = '2099-12-30'
const TEMP = '2099-12-31'
const repo = new PublicHolidayRepository()

beforeAll(async () => {
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_SUPABASE_EMAIL!,
    password: process.env.TEST_SUPABASE_PASSWORD!,
  })
  if (error) throw new Error(`Test setup sign-in failed: ${error.message}`)
  await repo.add(KEEP, 'TEST KEEP')
}, 30000)

afterAll(async () => {
  await repo.remove(KEEP)
  await repo.remove(TEMP)
  await supabase.auth.signOut()
})

describe('PublicHolidayRepository', () => {
  it('removes only the holiday on the given date', async () => {
    await repo.add(TEMP, 'TEST TEMP')
    await repo.remove(TEMP)
    const dates = (await repo.list()).map((h) => h.date)
    expect(dates).not.toContain(TEMP)
    expect(dates).toContain(KEEP)
  })

  it('test DB reset leaves the shared holiday table alone', async () => {
    await truncateTestDb()
    expect((await repo.list()).map((h) => h.date)).toContain(KEEP)
  })
})
