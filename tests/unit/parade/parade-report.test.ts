import { describe, it, expect } from 'vitest'
import { generateParadeReport } from '@/backend/domain/parade/parade-report'
import { FIXTURE_SOLDIERS } from '@/tests/fixtures/soldiers'
import { FIXTURE_EXCEPTIONS, FIXTURE_DATE } from '@/tests/fixtures/exceptions'
import { FIXTURE_DUTIES } from '@/tests/fixtures/duties'
import { FIXTURE_PARADE_CONFIG } from '@/tests/fixtures/config'
import type { Exception, Soldier } from '@/shared/types'

const BASE_INPUT = {
  date: FIXTURE_DATE,
  companyLabel: 'Test',
  soldiers: FIXTURE_SOLDIERS,
  paradeTimeStr: '09:30',
  duties: FIXTURE_DUTIES,
}

const ALL_EXCEPTIONS: Exception[] = FIXTURE_EXCEPTIONS.map((e, i) => ({ id: i + 1, ...e }))

describe('generateParadeReport — header', () => {
  it('includes the "40 SAR <COMPANY> COMPANY" line', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, FIXTURE_PARADE_CONFIG)
    expect(report.split('\n')[0]).toBe('40 SAR STALLION COMPANY')
  })

  it('defaults to FIRST PARADE STATE when paradeType is unset', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, FIXTURE_PARADE_CONFIG)
    expect(report.split('\n')[1]).toBe('FIRST PARADE STATE')
  })

  it('renders LAST PARADE STATE when paradeType is Last Parade', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [], paradeType: 'Last Parade' }, FIXTURE_PARADE_CONFIG)
    expect(report.split('\n')[1]).toBe('LAST PARADE STATE')
  })

  it('DATE/TIME line uses DDMMYY and HHMM with no colon', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('DATE: 150126 TIME: 0930')
  })

  it('TIME is blank when paradeTimeStr is empty', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [], paradeTimeStr: '' }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('DATE: 150126 TIME: ')
  })
})

describe('generateParadeReport — duty lines', () => {
  it('lists CDO/CDS/COS with rank + name', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('CDO: LTA LEE JUN WEI')
    expect(report).toContain('CDS: 1SG WONG KAH MENG')
    expect(report).toContain('COS: CPL YEO JIA HENG')
  })

  it('labels PDS lines using the platoon\'s pdsLabel, in platoon order', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('PDS 1: 3SG HO KAI XIANG')
    expect(report).toContain('PDS 2: -')
    expect(report).toContain('PDS 3: -')
  })

  it('unfilled CDO/CDS/COS shows "-"', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [], duties: [] }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('CDO: -')
    expect(report).toContain('CDS: -')
    expect(report).toContain('COS: -')
  })
})

describe('generateParadeReport — company-level strength', () => {
  it('COMPANY line and rank breakdown with no exceptions', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('COMPANY: 13/13')
    expect(report).toContain('OFFICER: 3/3')
    expect(report).toContain('WOSPEC: 4/4')
    expect(report).toContain('ENLISTEE: 6/6')
  })

  it('COMPANY line reflects absences', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: ALL_EXCEPTIONS }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('COMPANY: 9/13')
    expect(report).toContain('OFFICER: 2/3')
    expect(report).toContain('WOSPEC: 3/4')
    expect(report).toContain('ENLISTEE: 4/6')
  })

  it('zero soldiers → all strength values are 0', () => {
    const report = generateParadeReport({ ...BASE_INPUT, soldiers: [], activeExceptions: [], duties: [] }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('COMPANY: 0/0')
  })

  it('strength override changes the displayed company total', () => {
    const report = generateParadeReport(
      { ...BASE_INPUT, activeExceptions: [], strengthOverrides: { Total: { Officer: 5 } } },
      FIXTURE_PARADE_CONFIG,
    )
    expect(report).toContain('COMPANY: 15/15')
    expect(report).toContain('OFFICER: 5/5')
  })
})

describe('generateParadeReport — COY HQ block', () => {
  it('shows the HQ platoon strength and rank breakdown', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('COY HQ: 2/2')
  })

  it('reflects an Off/Leave absence for a HQ soldier', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: ALL_EXCEPTIONS }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('COY HQ: 1/2')
    expect(report).toContain('OFF/LEAVE: 1')
    expect(report).toContain('1. CPT TAN WEI LIANG - Annual Leave (140126-160126)')
  })

  it('all six sections are always printed, even when empty', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, FIXTURE_PARADE_CONFIG)
    const hqSection = report.split('COY HQ:')[1].split('--------------------------------')[0]
    expect(hqSection).toContain('ATT C: 0')
    expect(hqSection).toContain('STATUS: 0')
    expect(hqSection).toContain('REPORT SICK: 0')
    expect(hqSection).toContain('MA: 0')
    expect(hqSection).toContain('OFF/LEAVE: 0')
    expect(hqSection).toContain('OTHERS: 0')
  })
})

describe('generateParadeReport — platoon blocks', () => {
  it('lists platoon blocks in configured order with the "--------------------------------" separator', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, FIXTURE_PARADE_CONFIG)
    const pl1Idx = report.indexOf('PL 1: ')
    const pl2Idx = report.indexOf('PL 2: ')
    const pl3Idx = report.indexOf('PL 3: ')
    expect(pl1Idx).toBeGreaterThan(-1)
    expect(pl2Idx).toBeGreaterThan(pl1Idx)
    expect(pl3Idx).toBeGreaterThan(pl2Idx)
    expect(report).toContain('--------------------------------')
  })

  it('PL 1: MA and STATUS entries render as one numbered line each', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: ALL_EXCEPTIONS }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('PL 1: 3/4')
    expect(report).toContain('1. CPL LIM ZHEN HAO - MA (Skin Appt) (150126)')
    expect(report).toContain('1. PTE GOH RONG HAO - Excuse RMJ (100126-200126)')
  })

  it('PL 2: Others entry (non-absence) does not reduce present count', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: ALL_EXCEPTIONS }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('PL 2: 4/4')
    expect(report).toContain('1. PTE LIM WEI JIAN - Attending Course (140126-160126)')
  })

  it('PL 3: Att C and Report Sick reduce present count', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: ALL_EXCEPTIONS }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('PL 3: 0/2')
    expect(report).toContain('1. SSG CHONG KAH WAI - Fever (130126-170126)')
    expect(report).toContain('1. LCP TAN RONG XIAN - Flu (150126)')
  })

  it('Guard Duty exceptions are not printed under any of the six sections', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: ALL_EXCEPTIONS }, FIXTURE_PARADE_CONFIG)
    expect(report).not.toContain('Regimental Guard')
  })
})

describe('generateParadeReport — record line details', () => {
  it('prepends the soldier\'s 4D when set', () => {
    const soldiers: Soldier[] = FIXTURE_SOLDIERS.map((s) => s.name === 'LIM ZHEN HAO' ? { ...s, four_d: '1234' } : s)
    const exceptions: Exception[] = [{ id: 1, ...FIXTURE_EXCEPTIONS[2] }] // LIM ZHEN HAO — MA
    const report = generateParadeReport({ ...BASE_INPUT, soldiers, activeExceptions: exceptions }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('1. 1234 CPL LIM ZHEN HAO - MA (Skin Appt) (150126)')
  })

  it('appends IN/OUT only for scopes that carry it (Att C, Report Sick, MA, Others)', () => {
    const exceptions: Exception[] = [
      { id: 1, ...FIXTURE_EXCEPTIONS[3], in_out: 'OUT' },  // Att C — CHONG KAH WAI
      { id: 2, ...FIXTURE_EXCEPTIONS[4], in_out: 'OUT' },  // Status — GOH RONG HAO (not an IN/OUT scope)
    ]
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: exceptions }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('1. SSG CHONG KAH WAI - Fever (130126-170126) OUT')
    expect(report).toContain('1. PTE GOH RONG HAO - Excuse RMJ (100126-200126)')
    expect(report).not.toContain('Excuse RMJ (100126-200126) OUT')
  })

  it('appends @ location only for scopes that print it (MA, Others)', () => {
    const exceptions: Exception[] = [
      { id: 1, ...FIXTURE_EXCEPTIONS[2], location: 'CGH' },  // MA — LIM ZHEN HAO
      { id: 2, ...FIXTURE_EXCEPTIONS[3], location: 'CGH' },  // Att C — CHONG KAH WAI (not a location-print scope)
    ]
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: exceptions }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('1. CPL LIM ZHEN HAO - MA (Skin Appt) (150126) @ CGH')
    expect(report).toContain('1. SSG CHONG KAH WAI - Fever (130126-170126)')
    expect(report).not.toContain('Fever (130126-170126) @ CGH')
  })

  it('MA appointment time is appended as HHMM after the date', () => {
    const exceptions: Exception[] = [{ id: 1, ...FIXTURE_EXCEPTIONS[2], time: '14:30' }]
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: exceptions }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('MA (Skin Appt) (150126 1430)')
  })

  it('a permanent status with no end date renders as SINCE <start>', () => {
    const exceptions: Exception[] = [{
      id: 1, name: 'GOH RONG HAO', scope: 'Status', reason: 'Perm Excuse Pyrotechnics',
      start: '2026-01-01', end: null, counts_as_absence: false,
    }]
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: exceptions }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('1. PTE GOH RONG HAO - Perm Excuse Pyrotechnics (SINCE 010126)')
  })

  it('soldier in exception but not in nominal roll — falls back to bare name', () => {
    const exceptions: Exception[] = [{
      id: 99, name: 'GHOST SOLDIER', scope: 'Others', reason: 'Unknown',
      start: FIXTURE_DATE, end: FIXTURE_DATE, counts_as_absence: false,
    }]
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: exceptions }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('GHOST SOLDIER - Unknown')
  })
})

describe('generateParadeReport — person-centric exceptions', () => {
  const withIds: Soldier[] = FIXTURE_SOLDIERS.map((s, i) => ({ ...s, id: `u-${i}` }))
  const goh = withIds.find((s) => s.name === 'GOH RONG HAO')!
  const chong = withIds.find((s) => s.name === 'CHONG KAH WAI')!
  const input = { ...BASE_INPUT, soldiers: withIds }

  it('a revoked exception is left out of the lines and the strength', () => {
    const exceptions: Exception[] = [{
      id: 1, name: chong.name, soldier_id: chong.id, scope: 'Att C', reason: 'Fever',
      start: '2026-01-13', end: '2026-01-17', counts_as_absence: true, revoked_at: '2026-01-14T00:00:00Z',
    }]
    const report = generateParadeReport({ ...input, activeExceptions: exceptions }, FIXTURE_PARADE_CONFIG)
    expect(report).not.toContain('Fever')
    expect(report).toContain(`COMPANY: ${withIds.length}/${withIds.length}`)
  })

  it('an exception linked by soldier_id prints the current name after a rename', () => {
    const renamed = withIds.map((s) => (s.id === goh.id ? { ...s, name: 'GOH RONG HAO JUNIOR' } : s))
    const exceptions: Exception[] = [{
      id: 1, name: 'GOH RONG HAO', soldier_id: goh.id, scope: 'Status', reason: 'Excuse RMJ',
      start: '2026-01-10', end: '2026-01-20', counts_as_absence: false,
    }]
    const report = generateParadeReport({ ...input, soldiers: renamed, activeExceptions: exceptions }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('PTE GOH RONG HAO JUNIOR - Excuse RMJ')
  })

  it('a posted-out soldier leaves the strength and takes his exceptions with him', () => {
    const postedOut = withIds.map((s) => (s.id === chong.id ? { ...s, on_strength: false } : s))
    const exceptions: Exception[] = [{
      id: 1, name: chong.name, soldier_id: chong.id, scope: 'Att C', reason: 'Fever',
      start: '2026-01-13', end: '2026-01-17', counts_as_absence: true,
    }]
    const report = generateParadeReport({ ...input, soldiers: postedOut, activeExceptions: exceptions }, FIXTURE_PARADE_CONFIG)
    expect(report).not.toContain('Fever')
    expect(report).toContain(`COMPANY: ${withIds.length - 1}/${withIds.length - 1}`)
  })

  it('back-to-back MCs print once over the whole stretch', () => {
    const mc = { name: chong.name, soldier_id: chong.id, scope: 'Att C', type: 'MC', counts_as_absence: true }
    const exceptions: Exception[] = [
      { id: 1, ...mc, reason: '3D MC', start: '2026-01-13', end: '2026-01-15' },
      { id: 2, ...mc, reason: '2D MC', start: '2026-01-16', end: '2026-01-17' },
    ]
    const report = generateParadeReport({ ...input, activeExceptions: exceptions }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('ATT C: 1')
    expect(report).toContain('5D MC (130126-170126)')
  })
})
