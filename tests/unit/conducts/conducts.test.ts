import { describe, it, expect } from 'vitest'
import {
  conductEnd, conductDay, conductDateRange, conductTimeRange, nearestConduct,
  classifyConduct, generateConductState,
  conductSoldiers, seedDecisions,
} from '@/backend/domain/conducts/conducts'
import type { Conduct, ConductDecision, Exception, Soldier } from '@/shared/types'
import type { PlatoonBlock } from '@/shared/companies'

const C = (p: Partial<Conduct> = {}): Conduct => ({
  id: 'c1', name: 'IPPT1', date: '2026-09-22', end_date: null, start_time: null, end_time: null, ...p,
})

let nextId = 1
const ex = (p: Partial<Exception>): Exception => ({
  id: nextId++, name: '', scope: 'Status', reason: null, start: '2026-09-20', end: '2026-09-25',
  counts_as_absence: false, soldier_id: null, type: null, revoked_at: null, ...p,
})

const S = (id: string, rank: string, name: string, platoon: string, four_d: string | null = null): Soldier =>
  ({ id, rank, name, platoon, four_d })

const OC = S('oc', 'CPT', 'OC ONE', 'HQ')
const PC = S('pc', '2LT', 'PC ONE', '1')
const MC_GUY = S('mc', 'PTE', 'MC GUY', '1', '1101')
const LD_GUY = S('ld', 'PTE', 'LD GUY', '1', '1102')
const FLEGS = S('fl', 'PTE', 'FLEGS GUY', '2', '2101')
const FIT = S('fit', 'PTE', 'FIT GUY', '2', '2102')
const LEAVE = S('lv', 'CPL', 'LEAVE GUY', '2', '2103')
const SOLDIERS = [OC, PC, MC_GUY, LD_GUY, FLEGS, FIT, LEAVE]

const EXCEPTIONS: Exception[] = [
  ex({ soldier_id: 'mc', name: 'MC GUY', scope: 'Att C', type: 'MC', reason: '3D MC', counts_as_absence: true }),
  ex({ soldier_id: 'ld', name: 'LD GUY', scope: 'Status', type: 'LD', reason: 'FEVER, LD' }),
  ex({ soldier_id: 'fl', name: 'FLEGS GUY', scope: 'Status', type: 'Excuse', reason: 'Excuse FLEGS' }),
  ex({ soldier_id: 'lv', name: 'LEAVE GUY', scope: 'Off/Leave', type: 'Leave', reason: 'Annual Leave', counts_as_absence: true }),
]

const BLOCKS: PlatoonBlock[] = [
  { key: '1', label: 'PL 1', pdsLabel: 'PDS 1' },
  { key: '2', label: 'PL 2', pdsLabel: 'PDS 2' },
]

const dec = (p: Partial<ConductDecision>): ConductDecision =>
  ({ id: 'd', conduct_id: 'c1', soldier_id: 'fit', participating: false, reason: null, group_kind: null, ...p })
const byName = (parts: ReturnType<typeof classifyConduct>) => Object.fromEntries(parts.map((p) => [p.soldier.name, p]))

describe('conduct dates', () => {
  it('a missing end date means the single start day', () => {
    expect(conductEnd(C())).toBe('2026-09-22')
    expect(conductDateRange(C())).toBe('220926')
    expect(conductDateRange(C({ end_date: '2026-09-24' }))).toBe('220926 - 240926')
  })

  it('classifies against today while the conduct runs, else its nearest day', () => {
    const c = C({ date: '2026-09-22', end_date: '2026-09-24' })
    expect(conductDay(c, '2026-09-20')).toBe('2026-09-22')
    expect(conductDay(c, '2026-09-23')).toBe('2026-09-23')
    expect(conductDay(c, '2026-09-30')).toBe('2026-09-24')
  })

  it('prints the time window in the forms the template uses', () => {
    expect(conductTimeRange(C())).toBeNull()
    expect(conductTimeRange(C({ start_time: '08:00:00', end_time: '10:00:00' }))).toBe('0800 - 1000')
    expect(conductTimeRange(C({ start_time: '08:00:00' }))).toBe('FROM 0800')
    expect(conductTimeRange(C({ end_time: '18:00:00' }))).toBe('UNTIL 1800')
  })

  it('opens on whatever is running, else the nearest in time', () => {
    const now = new Date(2026, 8, 22, 9, 0)
    const running = C({ id: 'run', date: '2026-09-22', start_time: '08:00:00', end_time: '10:00:00' })
    const later = C({ id: 'later', date: '2026-09-22', start_time: '14:00:00' })
    const old = C({ id: 'old', date: '2026-09-01' })
    expect(nearestConduct([old, later, running], now)?.id).toBe('run')
    expect(nearestConduct([old, later], now)?.id).toBe('later')
    expect(nearestConduct([], now)).toBeNull()
  })
})

describe('classifyConduct', () => {
  it('no call -> participating', () => {
    expect(byName(classifyConduct(C(), SOLDIERS, []))['FIT GUY']).toMatchObject({ kind: 'in', reason: null })
  })

  it('a seeded out-of-camp call -> out of camp, with its reason', () => {
    const p = byName(classifyConduct(C(), SOLDIERS, [dec({ soldier_id: 'mc', reason: '3D MC', group_kind: 'out-of-camp' })]))
    expect(p['MC GUY']).toMatchObject({ kind: 'out-of-camp', reason: '3D MC' })
  })

  it('a hand fall-out takes its own reason; calls for another conduct are ignored', () => {
    const manual = dec({ reason: 'Duty' })
    expect(byName(classifyConduct(C(), SOLDIERS, [manual]))['FIT GUY']).toMatchObject({ kind: 'fall-out', reason: 'Duty' })
    expect(byName(classifyConduct(C(), SOLDIERS, [{ ...manual, conduct_id: 'c2' }]))['FIT GUY'].kind).toBe('in')
  })

  it('a participate call brings back a fall-out or someone out of camp', () => {
    const p = byName(classifyConduct(C(), SOLDIERS, [dec({ participating: true }), dec({ soldier_id: 'mc', participating: true })]))
    expect(p['FIT GUY']).toMatchObject({ kind: 'in' })
    expect(p['MC GUY']).toMatchObject({ kind: 'in' })
  })

  it('skips posted-out soldiers', () => {
    const postedOut = SOLDIERS.map((s) => (s.id === 'fit' ? { ...s, on_strength: false } : s))
    expect(byName(classifyConduct(C(), postedOut, []))['FIT GUY']).toBeUndefined()
  })
})

describe('conduct state text', () => {
  const today = '2026-09-22'
  const conduct = C({ start_time: '08:00:00', end_time: '10:00:00' })
  const parts = classifyConduct(conduct, conductSoldiers(SOLDIERS, true), [
    dec({ soldier_id: 'mc', reason: '3D MC', group_kind: 'out-of-camp' }),
    dec({ soldier_id: 'ld', reason: 'Duty' }),
  ])

  it('counts troopers only, and drops COY HQ when it sits out', () => {
    expect(byName(parts)['OC ONE']).toBeUndefined()
    expect(byName(parts)['PC ONE']).toBeUndefined()
    const hq = S('hq', 'PTE', 'HQ CLERK', 'HQ')
    expect(conductSoldiers([...SOLDIERS, hq], false).map((s) => s.name)).not.toContain('HQ CLERK')
    expect(conductSoldiers([...SOLDIERS, hq], true).map((s) => s.name)).toContain('HQ CLERK')
  })

  it('renders strength (in camp), those participating and those fallen out', () => {
    expect(generateConductState('Hercules', conduct, parts)).toBe([
      'HERCULES COY CONDUCT STATE',
      'CONDUCT: IPPT1',
      'DATE: 220926',
      'TIME: 0800 - 1000HRS',
      '',
      'STRENGTH: 04',
      '',
      'PARTICIPATING: 03',
      '1. 2103 CPL LEAVE GUY',
      '2. 2101 PTE FLEGS GUY',
      '3. 2102 PTE FIT GUY',
      '',
      'FALL OUT: 01',
      '1. 1102 PTE LD GUY — DUTY',
    ].join('\n'))
  })

  it('seeds out of camp for everyone absent on the Overview; present (even flagged) takes part', () => {
    const exs = [
      ex({ soldier_id: 'mc', name: 'MC GUY', scope: 'Att C', type: 'MC', reason: '3D MC', start: today, end: today, counts_as_absence: true }),
      ex({ soldier_id: 'ld', name: 'LD GUY', scope: 'Att C', type: 'MC', reason: 'x', start: today, end: today, counts_as_absence: true }),
    ]
    const marks = [
      { date: today, key: 'fit', kind: 'out' as const },
      { date: today, key: 'ld', kind: 'present' as const },
    ]
    const calls = seedDecisions(C(), SOLDIERS, exs, [], marks, [], today)
    const by = (id: string) => calls.find((x) => x.soldier_id === id)
    expect(by('mc')).toMatchObject({ participating: false, group_kind: 'out-of-camp', reason: 'MC' })
    expect(by('fit')).toMatchObject({ participating: false, group_kind: 'out-of-camp', reason: null })
    expect(by('ld')).toBeUndefined()
    expect(by('fl')).toBeUndefined()
  })
})
