import { describe, it, expect } from 'vitest'
import {
  conductEnd, conductDay, conductDateRange, conductTimeRange, nearestConduct,
  classifyConduct, needsDecision, generateConductState, generatePlatoonConductState, conductBlocks,
  conductSoldiers, conductIncludesHQ,
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
  const today = '2026-09-22'

  it('MC and out-of-camp soldiers fall out automatically with their reason', () => {
    const p = byName(classifyConduct(C(), SOLDIERS, EXCEPTIONS, [], today))
    expect(p['MC GUY']).toMatchObject({ kind: 'out-auto', participating: false, reason: '3D MC' })
    expect(p['LEAVE GUY']).toMatchObject({ kind: 'out-auto', participating: false, reason: 'Annual Leave' })
  })

  it('LD and RMJ fall out by default and wait for a commander\'s call', () => {
    const parts = classifyConduct(C(), SOLDIERS, EXCEPTIONS, [], today)
    expect(byName(parts)['LD GUY']).toMatchObject({ kind: 'out-default', participating: false, reason: 'FEVER, LD' })
    expect(needsDecision(parts).map((p) => p.soldier.name)).toEqual(['LD GUY'])
  })

  it('an RMJ bundled into an excuse reason also needs a call', () => {
    const rmj = [ex({ soldier_id: 'fit', name: 'FIT GUY', scope: 'Status', type: 'Excuse', reason: 'Excuse Heavy Loads, RMJ' })]
    expect(byName(classifyConduct(C(), SOLDIERS, rmj, [], today))['FIT GUY'].kind).toBe('out-default')
  })

  it('plain excuses take part, with the excuse shown as a note', () => {
    const p = byName(classifyConduct(C(), SOLDIERS, EXCEPTIONS, [], today))
    expect(p['FLEGS GUY']).toMatchObject({ kind: 'in-excused', participating: true, note: 'Excuse FLEGS' })
    expect(p['FIT GUY']).toMatchObject({ kind: 'in', participating: true, note: null })
  })

  it('a stored decision settles a pinged soldier either way', () => {
    const can: ConductDecision = { id: 'd1', conduct_id: 'c1', soldier_id: 'ld', participating: true, reason: null }
    expect(byName(classifyConduct(C(), SOLDIERS, EXCEPTIONS, [can], today))['LD GUY']).toMatchObject({ kind: 'in-confirmed', participating: true })
    const cannot = { ...can, participating: false }
    expect(byName(classifyConduct(C(), SOLDIERS, EXCEPTIONS, [cannot], today))['LD GUY']).toMatchObject({ kind: 'out-confirmed', reason: 'FEVER, LD' })
  })

  it('a manual fall-out takes its own reason; decisions for another conduct are ignored', () => {
    const manual: ConductDecision = { id: 'd2', conduct_id: 'c1', soldier_id: 'fit', participating: false, reason: 'Duty' }
    const other: ConductDecision = { ...manual, id: 'd3', conduct_id: 'c2' }
    expect(byName(classifyConduct(C(), SOLDIERS, EXCEPTIONS, [manual], today))['FIT GUY']).toMatchObject({ kind: 'out-manual', reason: 'Duty' })
    expect(byName(classifyConduct(C(), SOLDIERS, EXCEPTIONS, [other], today))['FIT GUY'].kind).toBe('in')
  })

  it('anyone marked absent falls out automatically, whatever the scope', () => {
    const absent = [ex({ soldier_id: 'fit', name: 'FIT GUY', scope: 'Others', type: 'Others', reason: 'Court', counts_as_absence: true })]
    expect(byName(classifyConduct(C(), SOLDIERS, absent, [], today))['FIT GUY']).toMatchObject({ kind: 'out-auto', reason: 'Court' })
  })

  it('a report sick falls out automatically, URTI or not', () => {
    const rs = [
      ex({ soldier_id: 'fit', name: 'FIT GUY', scope: 'Report Sick', type: 'URTI', reason: 'Flu', start: today, end: today }),
      ex({ soldier_id: 'fl', name: 'FLEGS GUY', scope: 'Report Sick', type: 'Report Sick', reason: 'Eczema', start: today, end: today }),
    ]
    const p = byName(classifyConduct(C(), SOLDIERS, rs, [], today))
    expect(p['FIT GUY']).toMatchObject({ kind: 'out-auto', reason: 'Report Sick — Flu' })
    expect(p['FLEGS GUY']).toMatchObject({ kind: 'out-auto', reason: 'Report Sick — Eczema' })
  })

  it('a medical review is only a note: the soldier still takes part', () => {
    const mr = [ex({ soldier_id: 'fit', name: 'FIT GUY', scope: 'Report Sick', type: 'Medical Review', reason: 'Knee review', start: today, end: today })]
    expect(byName(classifyConduct(C(), SOLDIERS, mr, [], today))['FIT GUY']).toMatchObject({ kind: 'in-excused', note: 'Knee review' })
  })

  it('a hard fall-out cannot be overridden by a decision', () => {
    const can: ConductDecision = { id: 'd4', conduct_id: 'c1', soldier_id: 'mc', participating: true, reason: null }
    expect(byName(classifyConduct(C(), SOLDIERS, EXCEPTIONS, [can], today))['MC GUY'].kind).toBe('out-auto')
  })

  it('reads exceptions on the conduct day, and skips revoked ones and posted-out soldiers', () => {
    const later = C({ date: '2026-09-30' })
    expect(byName(classifyConduct(later, SOLDIERS, EXCEPTIONS, [], today))['MC GUY'].kind).toBe('in')
    const revoked = EXCEPTIONS.map((e) => (e.soldier_id === 'mc' ? { ...e, revoked_at: '2026-09-21T00:00:00Z' } : e))
    expect(byName(classifyConduct(C(), SOLDIERS, revoked, [], today))['MC GUY'].kind).toBe('in')
    const postedOut = SOLDIERS.map((s) => (s.id === 'fit' ? { ...s, on_strength: false } : s))
    expect(byName(classifyConduct(C(), postedOut, EXCEPTIONS, [], today))['FIT GUY']).toBeUndefined()
  })
})

describe('conduct state text', () => {
  const today = '2026-09-22'
  const parts = classifyConduct(C({ start_time: '08:00:00', end_time: '10:00:00' }), SOLDIERS, EXCEPTIONS, [], today)
  const conduct = C({ start_time: '08:00:00', end_time: '10:00:00' })

  it('orders the blocks COY HQ then the platoons', () => {
    expect(conductBlocks(BLOCKS).map((b) => b.label)).toEqual(['COY HQ', 'PL 1', 'PL 2'])
  })

  it('Hercules leaves COY HQ out of the count and the text entirely', () => {
    expect(conductIncludesHQ('hercules')).toBe(false)
    expect(conductIncludesHQ('stallion')).toBe(true)
    const herc = classifyConduct(conduct, conductSoldiers('hercules', SOLDIERS), EXCEPTIONS, [], today)
    expect(byName(herc)['OC ONE']).toBeUndefined()
    const text = generateConductState('Hercules', conduct, herc, BLOCKS, false)
    expect(text).toContain('COMMANDERS: 01/01')
    expect(text).toContain('OVERALL: 03/06')
    expect(text).not.toContain('COY HQ')
    expect(conductBlocks(BLOCKS, false).map((b) => b.label)).toEqual(['PL 1', 'PL 2'])
    expect(conductSoldiers('stallion', SOLDIERS)).toHaveLength(SOLDIERS.length)
  })

  it('renders the company conduct state', () => {
    expect(generateConductState('Hercules', conduct, parts, BLOCKS)).toBe([
      'HERCULES COY CONDUCT STATE',
      'CONDUCT: IPPT1',
      'DATE: 220926',
      'TIME: 0800 - 1000HRS',
      '',
      'COMMANDERS: 02/02',
      'TROOPERS: 02/05',
      'OVERALL: 04/07',
      'FALL OUT: 03',
      '',
      'COY HQ: 00',
      '',
      'PL 1: 02',
      '1. 1101 PTE MC GUY — 3D MC',
      '2. 1102 PTE LD GUY — FEVER, LD',
      '',
      'PL 2: 01',
      '1. 2103 CPL LEAVE GUY — ANNUAL LEAVE',
      '',
      'COMMANDERS: 00',
    ].join('\n'))
  })

  it('renders one platoon, commanders at the bottom only when any fall out', () => {
    expect(generatePlatoonConductState(conduct, parts, BLOCKS[0])).toBe([
      'PL 1 CONDUCT STATE',
      'CONDUCT: IPPT1',
      'DATE: 220926',
      'TIME: 0800 - 1000HRS',
      '',
      'COMMANDERS: 01/01',
      'TROOPERS: 00/02',
      'OVERALL: 01/03',
      'FALL OUT: 02',
      '',
      '1. 1101 PTE MC GUY — 3D MC',
      '2. 1102 PTE LD GUY — FEVER, LD',
    ].join('\n'))
  })
})
