import { describe, it, expect } from 'vitest'
import { COMPANIES, COMPANY_THEMES, DISABLED_COMPANIES } from '@/lib/companies'

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
