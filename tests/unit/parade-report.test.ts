import { describe, it, expect } from 'vitest'
import { generateParadeReport } from '@/lib/parade-report'
import { FIXTURE_SOLDIERS } from '../fixtures/soldiers'
import { FIXTURE_EXCEPTIONS, FIXTURE_DATE } from '../fixtures/exceptions'
import { FIXTURE_DUTIES } from '../fixtures/duties'
import { FIXTURE_PARADE_CONFIG } from '../fixtures/config'
import type { Exception, Soldier } from '@/lib/supabase'
import { PARADE_CONFIG } from '@/lib/companies'

const FIXED_DATE = new Date('2026-01-15T10:00:00+08:00')

const BASE_INPUT = {
  date: FIXTURE_DATE,
  companyLabel: 'Test',
  soldiers: FIXTURE_SOLDIERS,
  paradeTimeStr: '09:30',
  duties: FIXTURE_DUTIES,
  generatedAt: FIXED_DATE,
}

// ── Standard (default) formatter ──────────────────────────────────────────────

describe('generateParadeReport — standard', () => {
  it('includes company name and date in header', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('STALLION COY PARADE STATE')
    expect(report).toContain('DATE:')
    expect(report).toContain('THURSDAY')
  })

  it('calculates correct totals with no exceptions (13 soldiers)', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('TOTAL STRENGTH : 13')
    expect(report).toContain('PRESENT        : 13')
    expect(report).toContain('ABSENT         : 0')
  })

  it('calculates correct totals with one absence exception', () => {
    const exceptions: Exception[] = [{ id: 1, ...FIXTURE_EXCEPTIONS[0] }] // TAN WEI LIANG Off/Leave
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: exceptions }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('TOTAL STRENGTH : 13')
    expect(report).toContain('PRESENT        : 12')
    expect(report).toContain('ABSENT         : 1')
  })

  it('calculates correct totals with all 4 fixture absences', () => {
    const exceptions: Exception[] = FIXTURE_EXCEPTIONS
      .filter(e => e.counts_as_absence)
      .map((e, i) => ({ id: i + 1, ...e }))
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: exceptions }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('TOTAL STRENGTH : 13')
    expect(report).toContain('PRESENT        : 9')
    expect(report).toContain('ABSENT         : 4')
  })

  it('shows present 0 when all soldiers have absence exceptions', () => {
    const exceptions: Exception[] = FIXTURE_SOLDIERS.map((s, i) => ({
      id: i + 1,
      name: s.name,
      scope: 'Off/Leave',
      reason: 'Test',
      start: FIXTURE_DATE,
      end: FIXTURE_DATE,
      counts_as_absence: true,
    }))
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: exceptions }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('PRESENT        : 0')
    expect(report).toContain('ABSENT         : 13')
  })

  it('non-absence exceptions do not reduce present count', () => {
    // GOH RONG HAO has Status, counts_as_absence: false
    const exceptions: Exception[] = [{ id: 5, ...FIXTURE_EXCEPTIONS[4] }]
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: exceptions }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('PRESENT        : 13')
    expect(report).toContain('ABSENT         : 0')
  })

  it('Guard Duty and Others exceptions do not reduce present count', () => {
    // WONG KAH MENG (Guard Duty) and LIM WEI JIAN (Others), both counts_as_absence: false
    const exceptions: Exception[] = [
      { id: 6, ...FIXTURE_EXCEPTIONS[5] },
      { id: 7, ...FIXTURE_EXCEPTIONS[6] },
    ]
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: exceptions }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('PRESENT        : 13')
    expect(report).toContain('ABSENT         : 0')
  })

  it('all exceptions non-absence → present equals total, absent 0', () => {
    const exceptions: Exception[] = FIXTURE_EXCEPTIONS.map((e, i) => ({
      id: i + 1, ...e, counts_as_absence: false,
    }))
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: exceptions }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('PRESENT        : 13')
    expect(report).toContain('ABSENT         : 0')
  })

  it('includes exception details in EXCEPTIONS section', () => {
    const exceptions: Exception[] = [{ id: 1, ...FIXTURE_EXCEPTIONS[0] }] // TAN WEI LIANG
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: exceptions }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('EXCEPTIONS:')
    expect(report).toContain('OFF/LEAVE:')
    expect(report).toContain('CPT TAN WEI LIANG')
    expect(report).toContain('Annual Leave')
  })

  it('no EXCEPTIONS section when activeExceptions is empty', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, FIXTURE_PARADE_CONFIG)
    expect(report).not.toContain('EXCEPTIONS:')
  })

  it('includes duty assignments in DUTIES section', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('DUTIES:')
    expect(report).toContain('CDO: LTA LEE JUN WEI')
  })

  it('no DUTIES section when duties array is empty', () => {
    const report = generateParadeReport(
      { ...BASE_INPUT, activeExceptions: [], duties: [] },
      FIXTURE_PARADE_CONFIG,
    )
    expect(report).not.toContain('DUTIES:')
  })

  it('includes the parade time labeled PARADE TIME when paradeType is unset', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('PARADE TIME — 0930H')
  })

  it('labels the parade time line with the given paradeType', () => {
    const report = generateParadeReport(
      { ...BASE_INPUT, activeExceptions: [], paradeType: 'First Parade' },
      FIXTURE_PARADE_CONFIG,
    )
    expect(report).toContain('FIRST PARADE — 0930H')
  })

  it('no parade time line when paradeTimeStr is empty', () => {
    const report = generateParadeReport(
      { ...BASE_INPUT, activeExceptions: [], paradeTimeStr: '' },
      FIXTURE_PARADE_CONFIG,
    )
    expect(report).not.toContain('0930H')
    expect(report).not.toContain('PARADE TIME')
  })

  it('includes a Generated timestamp', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, FIXTURE_PARADE_CONFIG)
    expect(report).toContain('Generated:')
  })

  it('paradeType Last Parade replaces FIRST with LAST in header', () => {
    const config = { ...FIXTURE_PARADE_CONFIG, header: ['STALLION COY FIRST PARADE STATE'] }
    const report = generateParadeReport(
      { ...BASE_INPUT, activeExceptions: [], paradeType: 'Last Parade' },
      config,
    )
    expect(report).toContain('STALLION COY LAST PARADE STATE')
    expect(report).not.toContain('FIRST PARADE STATE')
  })

  it('zero soldiers → all strength values are 0', () => {
    const report = generateParadeReport(
      { ...BASE_INPUT, soldiers: [], activeExceptions: [], duties: [] },
      FIXTURE_PARADE_CONFIG,
    )
    expect(report).toContain('TOTAL STRENGTH : 0')
    expect(report).toContain('PRESENT        : 0')
    expect(report).toContain('ABSENT         : 0')
  })

  it('strength override changes displayed total', () => {
    const report = generateParadeReport(
      {
        ...BASE_INPUT,
        activeExceptions: [],
        strengthOverrides: { Total: { Officer: 5 } },
      },
      FIXTURE_PARADE_CONFIG,
    )
    // Officer total overridden to 5 (was 3), so grand total = 5 + 4 + 6 = 15
    expect(report).toContain('TOTAL STRENGTH : 15')
    expect(report).toContain('OFFICER  : 5')
  })

  it('soldier in exception but not in nominal roll — displayName falls back to bare name', () => {
    const exceptions: Exception[] = [{
      id: 99, name: 'GHOST SOLDIER', scope: 'Off/Leave', reason: 'Unknown',
      start: FIXTURE_DATE, end: FIXTURE_DATE, counts_as_absence: true,
    }]
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: exceptions }, FIXTURE_PARADE_CONFIG)
    // No rank prefix — just the bare name
    expect(report).toContain('GHOST SOLDIER')
    expect(report).not.toContain('undefined GHOST SOLDIER')
  })
})

// ── Stallion formatter ────────────────────────────────────────────────────────

describe('generateParadeReport — stallion', () => {
  const stallionConfig = PARADE_CONFIG.stallion

  it('includes PARADE STATE FOR DDMMYY header', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, stallionConfig, 'stallion')
    expect(report).toContain('PARADE STATE FOR 150126')
  })

  it('has per-platoon breakdown sections', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, stallionConfig, 'stallion')
    expect(report).toContain('HQ:')
    expect(report).toContain('PL 1:')
    expect(report).toContain('PL 2:')
    expect(report).toContain('PL 3:')
    expect(report).toContain('PL 4:')
  })

  it('shows correct company-level strength', () => {
    const exceptions = FIXTURE_EXCEPTIONS.filter(e => e.counts_as_absence).map((e, i) => ({ id: i + 1, ...e }))
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: exceptions }, stallionConfig, 'stallion')
    expect(report).toContain('TOTAL COY STR: 13')
    expect(report).toContain('CURRENT COY STR: 9/13')
  })

  it('Pl 4 shows 1/1 when no exceptions for that platoon', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, stallionConfig, 'stallion')
    expect(report).toContain('PL 4: 1/1')
  })

  it('platoon with all soldiers absent shows 0 present', () => {
    // Put all Pl 3 soldiers (SSG CHONG KAH WAI, LCP TAN RONG XIAN) on leave
    const pl3Absences: Exception[] = [
      { id: 1, name: 'CHONG KAH WAI', scope: 'Off/Leave', reason: 'AL', start: FIXTURE_DATE, end: FIXTURE_DATE, counts_as_absence: true },
      { id: 2, name: 'TAN RONG XIAN', scope: 'Off/Leave', reason: 'AL', start: FIXTURE_DATE, end: FIXTURE_DATE, counts_as_absence: true },
    ]
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: pl3Absences }, stallionConfig, 'stallion')
    expect(report).toContain('PL 3: 0/2')
  })

  it('MA with time shows HRS suffix', () => {
    const exceptions: Exception[] = [{ id: 3, ...FIXTURE_EXCEPTIONS[2], time: '14:30' }]
    const report = generateParadeReport(
      { ...BASE_INPUT, activeExceptions: exceptions, allExceptions: exceptions },
      stallionConfig,
      'stallion',
    )
    expect(report).toContain('UPCOMING MA:')
    expect(report).toContain('LIM ZHEN HAO')
    expect(report).toContain('1430HRS')
  })

  it('MA without time shows only date (no HRS suffix)', () => {
    const maNoTime: Exception[] = [{
      id: 10, name: 'YEO JIA HENG', scope: 'MA', reason: 'IMH Appt',
      start: FIXTURE_DATE, end: FIXTURE_DATE, counts_as_absence: true,
    }]
    const report = generateParadeReport(
      { ...BASE_INPUT, activeExceptions: maNoTime, allExceptions: maNoTime },
      stallionConfig,
      'stallion',
    )
    expect(report).toContain('UPCOMING MA:')
    expect(report).toContain('YEO JIA HENG')
    expect(report).not.toContain('HRS')
  })

  it('Last Parade replaces FIRST→LAST in Stallion header', () => {
    const report = generateParadeReport(
      { ...BASE_INPUT, activeExceptions: [], paradeType: 'Last Parade' },
      stallionConfig,
      'stallion',
    )
    expect(report).toContain('STALLION COY LAST PARADE')
    expect(report).not.toContain('STALLION COY FIRST PARADE')
  })
})

// ── Hercules formatter ────────────────────────────────────────────────────────

describe('generateParadeReport — hercules', () => {
  const herculesConfig = PARADE_CONFIG.hercules

  it('uses compact Total Str / Current Str labels', () => {
    const exceptions = FIXTURE_EXCEPTIONS.filter(e => e.counts_as_absence).map((e, i) => ({ id: i + 1, ...e }))
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: exceptions }, herculesConfig, 'hercules')
    expect(report).toContain('Total Str: 13')
    expect(report).toContain('Current Str: 9')
  })

  it('has [Officer] / [WOSpec] / [Men] rank breakdown', () => {
    const exceptions = FIXTURE_EXCEPTIONS.filter(e => e.counts_as_absence).map((e, i) => ({ id: i + 1, ...e }))
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: exceptions }, herculesConfig, 'hercules')
    expect(report).toContain('[Officer]: 2/3')
    expect(report).toContain('[WOSpec]: 3/4')
    expect(report).toContain('[Men]: 4/6')
  })

  it('only shows COS duty (hercules visibleDutyTypes is [COS])', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, herculesConfig, 'hercules')
    expect(report).toContain('COS: CPL YEO JIA HENG')
    expect(report).not.toContain('CDO:')
    expect(report).not.toContain('CDS:')
  })

  it('shows exception as bullet with end date', () => {
    const exceptions: Exception[] = [{ id: 1, ...FIXTURE_EXCEPTIONS[0] }] // TAN WEI LIANG Off/Leave end:2026-01-16
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: exceptions }, herculesConfig, 'hercules')
    expect(report).toContain('• CPT TAN WEI LIANG')
    expect(report).toContain('Annual Leave')
    expect(report).toContain('160126') // end date formatted DDMMYY
  })

  it('no bullet lines when no exceptions', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, herculesConfig, 'hercules')
    expect(report).not.toContain('•')
  })

  it('present count correct with no exceptions (total 13)', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, herculesConfig, 'hercules')
    expect(report).toContain('Total Str: 13')
    expect(report).toContain('Current Str: 13')
  })
})

// ── Archer formatter ──────────────────────────────────────────────────────────

describe('generateParadeReport — archer', () => {
  const archerConfig = PARADE_CONFIG.archer

  it('lists CDO/CDS/COS duty lines and correct company strength', () => {
    const exceptions = FIXTURE_EXCEPTIONS.filter(e => e.counts_as_absence).map((e, i) => ({ id: i + 1, ...e }))
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: exceptions }, archerConfig, 'archer')
    expect(report).toContain('CDO: LEE JUN WEI')
    expect(report).toContain('Total Strength: 9/13')
  })
})

// ── Braves formatter ──────────────────────────────────────────────────────────

describe('generateParadeReport — braves', () => {
  const bravesConfig = PARADE_CONFIG.braves

  it('uses bracketed OFFICER/WOSPEC/ENLISTEE strength format', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, bravesConfig, 'braves')
    expect(report).toContain('[OFFICER]: 03/03')
    expect(report).toContain('[WOSPEC]: 04/04')
    expect(report).toContain('[ENLISTEE]: 06/06')
  })
})

// ── Cougar formatter ──────────────────────────────────────────────────────────

describe('generateParadeReport — cougar', () => {
  const cougarConfig = PARADE_CONFIG.cougar

  it('only reports PLATOON 1, PLATOON 4, and COMMANDERS (platoons 2/3 excluded by design)', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] }, cougarConfig, 'cougar')
    expect(report).toContain('PLATOON 1:')
    expect(report).toContain('PLATOON 4:')
    expect(report).toContain('COMMANDERS:')
    expect(report).not.toContain('PLATOON 2')
    expect(report).not.toContain('PLATOON 3')
  })
})
