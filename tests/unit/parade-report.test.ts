import { describe, it, expect } from 'vitest'
import { generateParadeReport } from '@/lib/parade-report'
import { FIXTURE_SOLDIERS } from '../fixtures/soldiers'
import { FIXTURE_EXCEPTIONS, FIXTURE_DATE } from '../fixtures/exceptions'
import { FIXTURE_DUTIES } from '../fixtures/duties'
import { FIXTURE_CONFIG } from '../fixtures/config'
import type { Exception } from '@/lib/supabase'

const FIXED_DATE = new Date('2026-01-15T10:00:00+08:00')

const BASE_INPUT = {
  date: FIXTURE_DATE,
  companyLabel: 'Stallion',
  soldiers: FIXTURE_SOLDIERS,
  configs: FIXTURE_CONFIG,
  duties: FIXTURE_DUTIES,
  generatedAt: FIXED_DATE,
}

describe('generateParadeReport', () => {
  it('includes company name and date in header', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] })
    expect(report).toContain('STALLION COY PARADE STATE')
    expect(report).toContain('DATE:')
    expect(report).toContain('THURSDAY')
  })

  it('calculates correct totals with no exceptions', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] })
    expect(report).toContain('TOTAL STRENGTH : 3')
    expect(report).toContain('PRESENT        : 3')
    expect(report).toContain('ABSENT         : 0')
  })

  it('calculates correct totals with one exception', () => {
    const exceptions: Exception[] = [{ id: 1, ...FIXTURE_EXCEPTIONS[0] }]
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: exceptions })
    expect(report).toContain('TOTAL STRENGTH : 3')
    expect(report).toContain('PRESENT        : 2')
    expect(report).toContain('ABSENT         : 1')
  })

  it('shows present 0 when all soldiers have exceptions', () => {
    const exceptions: Exception[] = FIXTURE_SOLDIERS.map((s, i) => ({
      id: i + 1,
      name: s.name,
      scope: 'Off/Leave',
      reason: 'Test',
      start: FIXTURE_DATE,
      end: FIXTURE_DATE,
    }))
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: exceptions })
    expect(report).toContain('PRESENT        : 0')
    expect(report).toContain(`ABSENT         : ${FIXTURE_SOLDIERS.length}`)
  })

  it('includes exception details in EXCEPTIONS section', () => {
    const exceptions: Exception[] = [{ id: 1, ...FIXTURE_EXCEPTIONS[0] }]
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: exceptions })
    expect(report).toContain('EXCEPTIONS:')
    expect(report).toContain('OFF/LEAVE:')
    expect(report).toContain('TEST_SOLDIER_ONE')
    expect(report).toContain('Annual Leave')
  })

  it('includes duty assignments in DUTIES section', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] })
    expect(report).toContain('DUTIES:')
    expect(report).toContain('CDO: TEST_SOLDIER_TWO')
  })

  it('includes parade times from config', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] })
    expect(report).toContain('FIRST PARADE — 0930H')
    expect(report).toContain('LAST PARADE — 1730H')
  })

  it('includes a Generated timestamp', () => {
    const report = generateParadeReport({ ...BASE_INPUT, activeExceptions: [] })
    expect(report).toContain('Generated:')
  })
})
