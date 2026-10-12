import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { SoldierRepository } from '@/backend/data/repositories/SoldierRepository'
import { ExceptionRepository } from '@/backend/data/repositories/ExceptionRepository'
import { DutyRepository } from '@/backend/data/repositories/DutyRepository'
import { OffLeaveRepository } from '@/backend/data/repositories/OffLeaveRepository'
import { ConductRepository } from '@/backend/data/repositories/ConductRepository'
import { SettingsRepository } from '@/backend/data/repositories/SettingsRepository'
import { RESET_SETTINGS } from '@/tests/fixtures/config'
import { resetTestDb } from '@/tests/fixtures/db'
import { FIXTURE_DATE } from '@/tests/fixtures/exceptions'

// Real round trips against the Test_* tables, seeded with the dummy fixtures
beforeAll(resetTestDb, 30000)
afterAll(async () => {
  await new SettingsRepository('test').save(RESET_SETTINGS)
  await resetTestDb()
}, 30000)

describe('SoldierRepository', () => {
  const repo = new SoldierRepository('test')

  it('lists the seeded roll, optionally by platoon', async () => {
    const { data, error } = await repo.list(true)
    expect(error).toBeNull()
    expect(data).toHaveLength(13)
    expect(data[0].platoon <= data[12].platoon).toBe(true)
  })

  it('inserts, updates and removes a soldier', async () => {
    expect((await repo.insert({ rank: 'PTE', name: 'REPO TEST', platoon: '1' })).error).toBeNull()
    expect((await repo.update('REPO TEST', { rank: 'LCP', four_d: '9999' })).error).toBeNull()
    const row = (await repo.list()).data.find((s) => s.name === 'REPO TEST')
    expect(row).toMatchObject({ rank: 'LCP', four_d: '9999' })
    expect((await repo.remove('REPO TEST')).error).toBeNull()
    expect((await repo.list()).data.some((s) => s.name === 'REPO TEST')).toBe(false)
  })

  it('upsertMany overwrites by name instead of duplicating', async () => {
    await repo.upsertMany([{ rank: 'CPL', name: 'GOH RONG HAO', platoon: '1' }])
    const matches = (await repo.list()).data.filter((s) => s.name === 'GOH RONG HAO')
    expect(matches).toHaveLength(1)
    expect(matches[0].rank).toBe('CPL')
  })
})

describe('ExceptionRepository', () => {
  const repo = new ExceptionRepository('test')

  it('filters by scope', async () => {
    const { data } = await repo.list('Report Sick')
    expect(data.map((e) => e.name)).toEqual(['TAN RONG XIAN'])
  })

  it('inserts several rows at once, updates, renames and removes', async () => {
    const rows = [
      { name: 'NG BOON SENG', scope: 'Status', reason: 'Excuse Boots', start: FIXTURE_DATE, end: FIXTURE_DATE, counts_as_absence: false },
      { name: 'NG BOON SENG', scope: 'Status', reason: 'Excuse RMJ', start: FIXTURE_DATE, end: FIXTURE_DATE, counts_as_absence: false },
    ]
    expect((await repo.insert(rows)).error).toBeNull()
    const mine = async () => (await repo.list()).data.filter((e) => e.name.startsWith('NG BOON SENG') && e.reason?.startsWith('Excuse '))
    const [first] = await mine()
    expect((await repo.update(first.id, { reason: 'Excuse Uniform' })).error).toBeNull()
    expect((await repo.rename('NG BOON SENG', 'NG BOON SENGG')).error).toBeNull()
    const renamed = await mine()
    expect(renamed.map((e) => e.name)).toEqual(['NG BOON SENGG', 'NG BOON SENGG'])
    expect(renamed.map((e) => e.reason).sort()).toEqual(['Excuse RMJ', 'Excuse Uniform'])
    for (const e of renamed) await repo.remove(e.id)
    expect(await mine()).toHaveLength(0)
  })
})

describe('DutyRepository', () => {
  const repo = new DutyRepository('test')

  it('lists a date range and a single day', async () => {
    expect((await repo.list('2026-01-12', '2026-01-18')).data).toHaveLength(4)
    expect((await repo.list('2026-02-01', '2026-02-07')).data).toHaveLength(0)
    expect((await repo.listOn(FIXTURE_DATE)).data.find((d) => d.duty_type === 'CDO')?.name).toBe('LEE JUN WEI')
  })

  it('upsert replaces the holder and remove clears the duty', async () => {
    await repo.upsert({ duty_type: 'CDO', date: FIXTURE_DATE, name: 'CHEN MING ZHI' })
    const cdo = (await repo.listOn(FIXTURE_DATE)).data.filter((d) => d.duty_type === 'CDO')
    expect(cdo.map((d) => d.name)).toEqual(['CHEN MING ZHI'])
    await repo.remove('CDO', FIXTURE_DATE)
    expect((await repo.listOn(FIXTURE_DATE)).data.some((d) => d.duty_type === 'CDO')).toBe(false)
  })
})

describe('OffLeaveRepository', () => {
  const repo = new OffLeaveRepository('test')

  it('upserts, updates and removes a balance', async () => {
    await repo.upsert({ name: 'ONG JUN SHENG', off: 1.5, leave: 0 })
    await repo.update('ONG JUN SHENG', 2, 3)
    expect((await repo.list()).data.find((r) => r.name === 'ONG JUN SHENG')).toMatchObject({ off: 2, leave: 3 })
    await repo.remove('ONG JUN SHENG')
    expect((await repo.list()).data.some((r) => r.name === 'ONG JUN SHENG')).toBe(false)
  })
})

describe('ConductRepository', () => {
  const repo = new ConductRepository('test')

  it('creates a conduct, records and undoes a call, then deletes it', async () => {
    const { id, error } = await repo.insert({ name: 'ROUTE MARCH', date: FIXTURE_DATE, end_date: null, start_time: '08:00', end_time: null })
    expect(error).toBeNull()
    const soldier = (await new SoldierRepository('test').list()).data[0]
    await repo.decide(id!, soldier.id!, false, 'LD')
    await repo.decide(id!, soldier.id!, true, null) // a second call replaces the first
    const calls = (await repo.listDecisions()).data.filter((d) => d.conduct_id === id)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ participating: true, reason: null })
    await repo.removeDecision(calls[0].id)
    expect((await repo.listDecisions()).data.some((d) => d.conduct_id === id)).toBe(false)
    await repo.remove(id!)
    expect((await repo.list()).data.some((c) => c.id === id)).toBe(false)
  })
})

describe('SettingsRepository', () => {
  const repo = new SettingsRepository('test')

  it('saves a field and loads it back, keeping the others', async () => {
    await repo.save({ parade_times: { 'First Parade': '08:15', 'Last Parade': '17:30' } })
    const loaded = await repo.load()
    expect(loaded.parade_times['First Parade']).toBe('08:15')
    expect(loaded.duty_day_multipliers.MonThurs).toEqual(expect.any(Number))
  })

  it('rejects an invalid value before it reaches the database', async () => {
    await expect(repo.save({ duty_base_weights: { CDO: 'heavy' } } as never)).rejects.toThrow()
  })
})
