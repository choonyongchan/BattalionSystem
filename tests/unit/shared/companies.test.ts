import { describe, it, expect } from 'vitest'
import { DISABLED_COMPANIES, companyHref } from '@/shared/companies'
import { getRankType, RANK_ORDER, VALID_RANKS, isCommander } from '@/shared/ranks'
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

describe('RANK_ORDER', () => {
  it('ranks every valid rank, so none is left out of eligibility or seniority', () => {
    for (const r of VALID_RANKS) expect(RANK_ORDER, r).toContain(r)
  })

  it('places ME ranks beside their equivalents', () => {
    const at = (r: string) => RANK_ORDER.indexOf(r)
    expect(at('ME1')).toBe(at('3SG') + 1)
    expect(at('ME4')).toBe(at('LTA') + 1)
    expect(at('ME8')).toBe(at('SLTC') + 1)
  })

  it('isCommander is everyone but enlistees', () => {
    expect(isCommander({ rank: '3SG' })).toBe(true)
    expect(isCommander({ rank: 'CFC' })).toBe(false)
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
