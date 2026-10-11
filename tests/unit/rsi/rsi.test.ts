import { describe, it, expect } from 'vitest'
import { isUrti, generateRsiReport, rsiCompanyLabel } from '@/backend/domain/rsi/rsi'
import { soldierIndex } from '@/backend/domain/exceptions/active'
import type { Exception, Soldier } from '@/shared/types'

let nextId = 1
const rs = (soldier_id: string, type: string, reason: string): Exception => ({
  id: nextId++, name: '', scope: 'Report Sick', type, reason, start: '2026-10-08', end: '2026-10-08',
  counts_as_absence: false, soldier_id, revoked_at: null,
})

const SOLDIERS: Soldier[] = [
  { id: 'a', rank: 'PTE', name: 'HO WEI KANG', platoon: 'SIG', four_d: '1108' },
  { id: 'b', rank: 'PTE', name: 'TAY WEIYE MARCUS', platoon: 'MED', four_d: '1407' },
  { id: 'c', rank: 'PTE', name: 'NICHOLAS CHIA', platoon: 'HQ', four_d: null },
]
const idx = soldierIndex(SOLDIERS)

describe('isUrti', () => {
  it('reads upper-respiratory symptoms as URTI, the rest not', () => {
    expect(isUrti('Flu and phlegm')).toBe(true)
    expect(isUrti('Flu, Cough, and Sore Throat.')).toBe(true)
    expect(isUrti('Coughing')).toBe(true)
    expect(isUrti('Eczema')).toBe(false)
    expect(isUrti('Headache and Nausea')).toBe(false)
    expect(isUrti('Influenza-like')).toBe(false)
  })
})

describe('generateRsiReport', () => {
  it('prints the template, numbering each section from 01', () => {
    const text = generateRsiReport('2026-10-08', '08:50', 'hercules', [
      rs('a', 'URTI', 'Flu and phlegm'),
      rs('b', 'Report Sick', 'Eczema'),
      rs('c', 'Report Sick', 'Adapting Issues'),
    ], idx)
    expect(text).toBe([
      '081026 HQ COY 40SAR 0850HRS',
      'URTI',
      'S/N: 01',
      'R/N: 1108 PTE HO WEI KANG',
      'REASON: Flu and phlegm',
      '',
      'NON-URTI',
      'S/N: 01',
      'R/N: 1407 PTE TAY WEIYE MARCUS',
      'REASON: Eczema',
      '',
      'S/N: 02',
      'R/N: PTE NICHOLAS CHIA',
      'REASON: Adapting Issues',
    ].join('\n'))
  })

  it('prints NIL for an empty section', () => {
    expect(generateRsiReport('2026-10-08', '0850', 'stallion', [], idx)).toBe(
      ['081026 STALLION COY 40SAR 0850HRS', 'URTI', 'NIL', '', 'NON-URTI', 'NIL'].join('\n'))
  })

  it('labels Hercules as HQ COY', () => {
    expect(rsiCompanyLabel('hercules')).toBe('HQ COY')
    expect(rsiCompanyLabel('braves')).toBe('BRAVES COY')
  })
})
