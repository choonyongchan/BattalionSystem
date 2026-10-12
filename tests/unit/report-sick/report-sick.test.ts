import { describe, it, expect } from 'vitest'
import { isUrti, generateRsiReport, generateMedicalReviewReport, rsiCompanyLabel } from '@/backend/domain/report-sick/report-sick'
import { soldierIndex } from '@/backend/domain/exceptions/active'
import type { Exception, MedicalReview, Soldier } from '@/shared/types'

let nextId = 1
const rs = (soldier_id: string, type: string, reason: string, in_out: 'IN' | 'OUT' | null = null): Exception => ({
  id: nextId++, name: '', scope: 'Report Sick', type, reason, start: '2026-10-08', end: '2026-10-08',
  counts_as_absence: false, soldier_id, revoked_at: null, in_out,
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

  it('is the header alone when no one reported sick inside', () => {
    expect(generateRsiReport('2026-10-08', '0850', 'stallion', [], idx)).toBe('081026 STALLION COY 40SAR 0850HRS')
  })

  it('drops an empty section and leaves out RSO and medical reviews', () => {
    const text = generateRsiReport('2026-10-08', '0850', 'stallion', [
      rs('a', 'Report Sick', 'Eczema', 'IN'),
      rs('b', 'URTI', 'Flu', 'OUT'),
      rs('c', 'Medical Review', 'Revoke FLEGS Status'),
    ], idx)
    expect(text).toBe(['081026 STALLION COY 40SAR 0850HRS', 'NON-URTI', 'S/N: 01', 'R/N: 1108 PTE HO WEI KANG', 'REASON: Eczema'].join('\n'))
  })

  it('labels Hercules as HQ COY', () => {
    expect(rsiCompanyLabel('hercules')).toBe('HQ COY')
    expect(rsiCompanyLabel('braves')).toBe('BRAVES COY')
  })
})

describe('generateMedicalReviewReport', () => {
  const review = (exception_id: number, extra: Partial<MedicalReview> = {}): MedicalReview => ({
    exception_id, nric: 'S0000000A', coy: 'ARCHER', last_ma: null, next_ma: null, memo: false, remarks: null, ...extra,
  })

  it('prints the template, with - NIL and NIL for blanks', () => {
    const e = rs('c', 'Medical Review', 'Revoke FLEGS Status')
    expect(generateMedicalReviewReport([{ exception: e, review: review(e.id) }], idx)).toBe([
      '*MEDICAL REVIEW*',
      'S/N: 01',
      'Rank + Name: PTE NICHOLAS CHIA',
      'Coy: ARCHER',
      'NRIC: S0000000A',
      'Diagnosis/Issue: Revoke FLEGS Status',
      'Date of most recent Medical Appointment: - NIL',
      'Date of Next MA: - NIL',
      'Memo (Yes/No): No',
      'Remarks/Requests: NIL',
    ].join('\n'))
  })

  it('numbers reviews and prints dates, memo and remarks when given', () => {
    const a = rs('a', 'Medical Review', 'Knee pain')
    const b = rs('b', 'Medical Review', 'Back pain')
    const text = generateMedicalReviewReport([
      { exception: a, review: review(a.id) },
      { exception: b, review: review(b.id, { last_ma: '2026-10-01', next_ma: '2026-11-03', memo: true, remarks: 'Needs MO letter' }) },
    ], idx)
    expect(text).toContain('Remarks/Requests: NIL\n\nS/N: 02\nRank + Name: PTE TAY WEIYE MARCUS')
    expect(text).toContain('Date of most recent Medical Appointment: 011026\nDate of Next MA: 031126\nMemo (Yes/No): Yes\nRemarks/Requests: Needs MO letter')
  })

  it('prints NIL when there are no reviews', () => {
    expect(generateMedicalReviewReport([], idx)).toBe('*MEDICAL REVIEW*\nNIL')
  })
})
