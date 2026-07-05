import { describe, it, expect } from 'vitest'
import { COMPANIES, COMPANY_THEMES, DISABLED_COMPANIES, getRankType, DEFAULT_RANK_RULES, DUTY_ELIGIBILITY, PARADE_CONFIG } from '@/lib/companies'
import { displayName } from '@/lib/supabase'

describe('DISABLED_COMPANIES', () => {
  it('marks archer, braves, cougar as disabled', () => {
    expect(DISABLED_COMPANIES.has('archer')).toBe(true)
    expect(DISABLED_COMPANIES.has('braves')).toBe(true)
    expect(DISABLED_COMPANIES.has('cougar')).toBe(true)
  })

  it('marks stallion and hercules as enabled', () => {
    expect(DISABLED_COMPANIES.has('stallion')).toBe(false)
    expect(DISABLED_COMPANIES.has('hercules')).toBe(false)
  })
})

describe('COMPANY_THEMES', () => {
  const REQUIRED_TOKENS = [
    'cardBorder', 'cardHoverBg', 'cardText', 'activeBorder', 'activeText',
    'buttonBg', 'buttonHoverBg', 'focusRing', 'badgeBg', 'badgeText',
  ] as const

  COMPANIES.forEach((company) => {
    it(`${company} has all required theme tokens`, () => {
      const theme = COMPANY_THEMES[company]
      REQUIRED_TOKENS.forEach((token) => {
        expect(theme[token], `${company}.${token}`).toBeTruthy()
      })
    })
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
