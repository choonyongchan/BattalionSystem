import { describe, it, expect } from 'vitest'
import { COMPANIES, DISABLED_COMPANIES, companyHref, PARADE_CONFIG, pointsDutyTypes } from '@/shared/companies'
import { getRankType, DEFAULT_RANK_RULES, DUTY_ELIGIBILITY } from '@/shared/ranks'
import { displayName } from '@/shared/names'

describe('DISABLED_COMPANIES', () => {
  it('only Hercules (and the hidden test company) is live', () => {
    for (const c of ['archer', 'braves', 'cougar', 'stallion'] as const) expect(DISABLED_COMPANIES.has(c)).toBe(true)
    expect(DISABLED_COMPANIES.has('hercules')).toBe(false)
    expect(DISABLED_COMPANIES.has('test')).toBe(false)
  })
})

describe('companyHref', () => {
  it('serves the primary company at the root and others under their name', () => {
    expect(companyHref('hercules')).toBe('/')
    expect(companyHref('hercules', 'settings')).toBe('/settings/')
    expect(companyHref('test', 'settings')).toBe('/test/settings/')
  })
})

describe('getRankType', () => {
  it('classifies one rank from each tier, and falls back to Enlistee for unknown ranks', () => {
    expect(getRankType('LTA')).toBe('Officer')
    expect(getRankType('3SG')).toBe('WOSPEC')
    expect(getRankType('CPL')).toBe('Enlistee')
    expect(getRankType('BRIG')).toBe('Enlistee')
  })
})

describe('DEFAULT_RANK_RULES / DUTY_ELIGIBILITY', () => {
  it('has a default rank rule for every duty type', () => {
    Object.keys(DUTY_ELIGIBILITY).forEach((dutyType) => {
      expect(DEFAULT_RANK_RULES[dutyType], dutyType).toBeDefined()
    })
  })
})

describe('PARADE_CONFIG', () => {
  it('every company\'s visibleDutyTypes are valid DUTY_ELIGIBILITY keys', () => {
    COMPANIES.forEach((company) => {
      PARADE_CONFIG[company].visibleDutyTypes.forEach((dt) => {
        expect(DUTY_ELIGIBILITY[dt], `${company}: ${dt}`).toBeDefined()
      })
    })
  })
})

describe('displayName', () => {
  const soldiers = [{ rank: 'CPL', name: 'TAN AH KOW', platoon: '1' }]
  it('prefixes the rank when the soldier is found', () => {
    expect(displayName('TAN AH KOW', soldiers)).toBe('CPL TAN AH KOW')
  })
  it('falls back to the bare name when not found', () => {
    expect(displayName('UNKNOWN', soldiers)).toBe('UNKNOWN')
  })
})

describe('pointsDutyTypes', () => {
  it('adds Duty Clerk for Hercules only, with Guard Duty last', () => {
    expect(pointsDutyTypes('hercules')).toEqual(['CDO', 'CDS', 'COS', 'PDS1', 'PDS2', 'PDS3', 'Duty Clerk', 'Guard Duty'])
    expect(pointsDutyTypes('stallion')).not.toContain('Duty Clerk')
    expect(pointsDutyTypes('stallion').at(-1)).toBe('Guard Duty')
  })
})
