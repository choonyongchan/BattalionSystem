import { describe, it, expect } from 'vitest'
import { isEligible, eligibleSoldiers, isRankRangeInvalid } from '@/lib/duty/duty-rules'
import { FIXTURE_SOLDIERS } from '../../fixtures/soldiers'
import type { Soldier } from '@/lib/supabase'

function s(rank: string, name = 'SOLDIER'): Soldier {
  return { rank, name, platoon: '1' }
}

const NO_OVERRIDES = {}
const NO_RANK_RULES = {}

// â”€â”€ CDO (DEFAULT_RANK_RULES: { from: '2LT', to: 'LTA' }) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RANK_ORDER indices: 2LT=16, LTA=17, CPT=18

describe('CDO eligibility', () => {
  it('LTA is eligible (upper bound)', () => {
    expect(isEligible('CDO', s('LTA'), NO_OVERRIDES, NO_RANK_RULES)).toBe(true)
  })

  it('2LT is eligible (lower bound)', () => {
    expect(isEligible('CDO', s('2LT'), NO_OVERRIDES, NO_RANK_RULES)).toBe(true)
  })

  it('CPT is NOT eligible (one step above upper bound LTA)', () => {
    expect(isEligible('CDO', s('CPT'), NO_OVERRIDES, NO_RANK_RULES)).toBe(false)
  })

  it('3SG is NOT eligible (WOSPEC, far below lower bound)', () => {
    expect(isEligible('CDO', s('3SG'), NO_OVERRIDES, NO_RANK_RULES)).toBe(false)
  })

  it('REC is NOT eligible (far below lower bound)', () => {
    expect(isEligible('CDO', s('REC'), NO_OVERRIDES, NO_RANK_RULES)).toBe(false)
  })
})

// â”€â”€ CDS (DEFAULT_RANK_RULES: { from: '2SG', to: '1SG' }) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RANK_ORDER indices: 3SG=5, 2SG=6, 1SG=7, SSG=8

describe('CDS eligibility', () => {
  it('2SG is eligible (lower bound)', () => {
    expect(isEligible('CDS', s('2SG'), NO_OVERRIDES, NO_RANK_RULES)).toBe(true)
  })

  it('1SG is eligible (upper bound)', () => {
    expect(isEligible('CDS', s('1SG'), NO_OVERRIDES, NO_RANK_RULES)).toBe(true)
  })

  it('3SG is NOT eligible (one step below lower bound 2SG)', () => {
    expect(isEligible('CDS', s('3SG'), NO_OVERRIDES, NO_RANK_RULES)).toBe(false)
  })

  it('SSG is NOT eligible (one step above upper bound 1SG)', () => {
    expect(isEligible('CDS', s('SSG'), NO_OVERRIDES, NO_RANK_RULES)).toBe(false)
  })

  it('CPL is NOT eligible (Enlistee, below range)', () => {
    expect(isEligible('CDS', s('CPL'), NO_OVERRIDES, NO_RANK_RULES)).toBe(false)
  })
})

// â”€â”€ COS (DEFAULT_RANK_RULES: { from: 'PTE', to: '3SG' }) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RANK_ORDER indices: REC=0, PTE=1, LCP=2, CPL=3, CFC=4, 3SG=5

describe('COS eligibility', () => {
  it('PTE is eligible (lower bound)', () => {
    expect(isEligible('COS', s('PTE'), NO_OVERRIDES, NO_RANK_RULES)).toBe(true)
  })

  it('3SG is eligible (upper bound)', () => {
    expect(isEligible('COS', s('3SG'), NO_OVERRIDES, NO_RANK_RULES)).toBe(true)
  })

  it('CPL is eligible (mid-range)', () => {
    expect(isEligible('COS', s('CPL'), NO_OVERRIDES, NO_RANK_RULES)).toBe(true)
  })

  it('LCP is eligible (mid-range)', () => {
    expect(isEligible('COS', s('LCP'), NO_OVERRIDES, NO_RANK_RULES)).toBe(true)
  })

  it('REC is NOT eligible (one step below lower bound PTE)', () => {
    expect(isEligible('COS', s('REC'), NO_OVERRIDES, NO_RANK_RULES)).toBe(false)
  })

  it('SSG is NOT eligible (one step above upper bound 3SG)', () => {
    expect(isEligible('COS', s('SSG'), NO_OVERRIDES, NO_RANK_RULES)).toBe(false)
  })

  it('LTA is NOT eligible (Officer, far above upper bound)', () => {
    expect(isEligible('COS', s('LTA'), NO_OVERRIDES, NO_RANK_RULES)).toBe(false)
  })
})

// â”€â”€ PDS1 (DEFAULT_RANK_RULES: { from: '3SG', to: '1SG' }) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RANK_ORDER indices: CPL=3, 3SG=5, 2SG=6, 1SG=7, SSG=8

describe('PDS1 eligibility', () => {
  it('3SG is eligible (lower bound)', () => {
    expect(isEligible('PDS1', s('3SG'), NO_OVERRIDES, NO_RANK_RULES)).toBe(true)
  })

  it('1SG is eligible (upper bound)', () => {
    expect(isEligible('PDS1', s('1SG'), NO_OVERRIDES, NO_RANK_RULES)).toBe(true)
  })

  it('2SG is eligible (mid-range)', () => {
    expect(isEligible('PDS1', s('2SG'), NO_OVERRIDES, NO_RANK_RULES)).toBe(true)
  })

  it('CPL is NOT eligible (one step below lower bound 3SG â€” Enlistee)', () => {
    expect(isEligible('PDS1', s('CPL'), NO_OVERRIDES, NO_RANK_RULES)).toBe(false)
  })

  it('SSG is NOT eligible (one step above upper bound 1SG)', () => {
    expect(isEligible('PDS1', s('SSG'), NO_OVERRIDES, NO_RANK_RULES)).toBe(false)
  })
})

// â”€â”€ Name overrides â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('name overrides', () => {
  it('soldier in name override list is eligible regardless of rank', () => {
    const cpl: Soldier = { rank: 'CPL', name: 'TAN AH KOW', platoon: '1' }
    // CPL would normally fail CDO, but override includes this name
    expect(isEligible('CDO', cpl, { CDO: ['TAN AH KOW'] }, NO_RANK_RULES)).toBe(true)
  })

  it('soldier NOT in name override list is ineligible even if rank would pass', () => {
    const lta: Soldier = { rank: 'LTA', name: 'LEE BOON SENG', platoon: '1' }
    // LTA passes CDO rank rule, but override is set to someone else
    expect(isEligible('CDO', lta, { CDO: ['SOMEONE_ELSE'] }, NO_RANK_RULES)).toBe(false)
  })

  it('empty name override array falls back to rank rule', () => {
    const lta: Soldier = { rank: 'LTA', name: 'LEE BOON SENG', platoon: '1' }
    // Empty list means no override â€” rank rule applies; LTA passes CDO
    expect(isEligible('CDO', lta, { CDO: [] }, NO_RANK_RULES)).toBe(true)
  })
})

// â”€â”€ Rank rule overrides â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('rank rule overrides', () => {
  it('custom rank rule overrides DEFAULT_RANK_RULES for that duty', () => {
    // Override CDO to allow 3SG..SSG range instead of 2LT..LTA
    const customRule = { CDO: { from: '3SG', to: 'SSG' } }
    expect(isEligible('CDO', s('3SG'), NO_OVERRIDES, customRule)).toBe(true)
    expect(isEligible('CDO', s('SSG'), NO_OVERRIDES, customRule)).toBe(true)
    expect(isEligible('CDO', s('LTA'), NO_OVERRIDES, customRule)).toBe(false)
  })

  it('rank rule override does not affect other duty types', () => {
    const customRule = { CDO: { from: '3SG', to: 'SSG' } }
    // CDS still uses its default rule
    expect(isEligible('CDS', s('1SG'), NO_OVERRIDES, customRule)).toBe(true)
    expect(isEligible('CDS', s('3SG'), NO_OVERRIDES, customRule)).toBe(false)
  })
})

// â”€â”€ Negative / edge cases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('edge cases', () => {
  it('unknown duty type returns false', () => {
    expect(isEligible('XYZ', s('LTA'), NO_OVERRIDES, NO_RANK_RULES)).toBe(false)
  })

  it('soldier with unknown rank (not in RANK_ORDER) returns false', () => {
    expect(isEligible('COS', s('BRIG'), NO_OVERRIDES, NO_RANK_RULES)).toBe(false)
  })

  it('eligibleSoldiers returns empty array for empty soldiers list', () => {
    const result = eligibleSoldiers('COS', [], NO_OVERRIDES, NO_RANK_RULES)
    expect(result).toHaveLength(0)
  })

  it('eligibleSoldiers returns empty when no soldier meets criteria (all REC for COS)', () => {
    const allREC: Soldier[] = [
      { rank: 'REC', name: 'A', platoon: '1' },
      { rank: 'REC', name: 'B', platoon: '1' },
    ]
    const result = eligibleSoldiers('COS', allREC, NO_OVERRIDES, NO_RANK_RULES)
    expect(result).toHaveLength(0)
  })
})

// â”€â”€ eligibleSoldiers against realistic 13-soldier fixture â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('eligibleSoldiers â€” fixture soldiers', () => {
  it('CDO returns only 2LT..LTA soldiers (LEE JUN WEI and CHEN MING ZHI)', () => {
    const result = eligibleSoldiers('CDO', FIXTURE_SOLDIERS, NO_OVERRIDES, NO_RANK_RULES)
    const names = result.map(s => s.name)
    expect(names).toContain('LEE JUN WEI')
    expect(names).toContain('CHEN MING ZHI')
    // CPT TAN WEI LIANG is above LTA upper bound â€” excluded
    expect(names).not.toContain('TAN WEI LIANG')
    expect(result).toHaveLength(2)
  })

  it('COS returns PTE..3SG range only (7 of 13): excludes Officers, higher WOSPECs, and REC', () => {
    // DEFAULT_RANK_RULES.COS = { from: 'PTE'(1), to: '3SG'(5) }
    // Eligible: PTE, LCP, CPL, CFC, 3SG â€” not REC (below), not SSG/1SG/CPT/LTA (above)
    const result = eligibleSoldiers('COS', FIXTURE_SOLDIERS, NO_OVERRIDES, NO_RANK_RULES)
    const names = result.map(s => s.name)
    expect(result).toHaveLength(7)
    // Included: 3SGÃ—2, CPLÃ—2, PTEÃ—2, LCPÃ—1
    expect(names).toContain('NG BOON SENG')   // 3SG
    expect(names).toContain('HO KAI XIANG')   // 3SG
    expect(names).toContain('LIM ZHEN HAO')   // CPL
    expect(names).toContain('YEO JIA HENG')   // CPL
    expect(names).toContain('GOH RONG HAO')   // PTE
    expect(names).toContain('LIM WEI JIAN')   // PTE
    expect(names).toContain('TAN RONG XIAN')  // LCP
    // Excluded
    expect(names).not.toContain('ONG JUN SHENG')  // REC â€” below lower bound
    expect(names).not.toContain('CHONG KAH WAI')  // SSG â€” above upper bound
    expect(names).not.toContain('TAN WEI LIANG')  // CPT â€” far above
    expect(names).not.toContain('WONG KAH MENG')  // 1SG â€” above upper bound
  })

  it('PDS1 returns 3SGÃ—2 + 1SGÃ—1 (NG BOON SENG, HO KAI XIANG, WONG KAH MENG)', () => {
    const result = eligibleSoldiers('PDS1', FIXTURE_SOLDIERS, NO_OVERRIDES, NO_RANK_RULES)
    const names = result.map(s => s.name)
    expect(names).toContain('NG BOON SENG')   // 3SG
    expect(names).toContain('HO KAI XIANG')   // 3SG
    expect(names).toContain('WONG KAH MENG')  // 1SG
    expect(result).toHaveLength(3)
  })
})

// â”€â”€ isRankRangeInvalid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('isRankRangeInvalid', () => {
  it('returns false for a valid range (from before to)', () => {
    expect(isRankRangeInvalid({ from: '2LT', to: 'LTA' })).toBe(false)
  })

  it('returns false for a single-rank range (from equals to)', () => {
    expect(isRankRangeInvalid({ from: '3SG', to: '3SG' })).toBe(false)
  })

  it('returns true for a reversed range (from after to)', () => {
    expect(isRankRangeInvalid({ from: 'LTA', to: '2LT' })).toBe(true)
  })

  it('returns true when a rank is not in RANK_ORDER', () => {
    expect(isRankRangeInvalid({ from: 'BRIG', to: 'LTA' })).toBe(true)
  })
})
