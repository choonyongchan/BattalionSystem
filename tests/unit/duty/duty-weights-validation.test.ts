import { describe, it, expect } from 'vitest'
import { hasDuplicateExceptionRows } from '@/lib/duty/duty-weights-validation'

describe('hasDuplicateExceptionRows', () => {
  it('returns false when all rows have distinct duty type + day type keys', () => {
    const rows = [
      { dutyType: 'CDO', dayType: 'Normal' },
      { dutyType: 'CDS', dayType: 'Friday' },
    ]
    expect(hasDuplicateExceptionRows(rows)).toBe(false)
  })

  it('returns false for an empty list', () => {
    expect(hasDuplicateExceptionRows([])).toBe(false)
  })

  it('returns true when two rows share the same duty type + day type', () => {
    const rows = [
      { dutyType: 'CDO', dayType: 'Normal' },
      { dutyType: 'CDO', dayType: 'Normal' },
    ]
    expect(hasDuplicateExceptionRows(rows)).toBe(true)
  })

  it('does not flag rows with the same duty type but different day types', () => {
    const rows = [
      { dutyType: 'CDO', dayType: 'Normal' },
      { dutyType: 'CDO', dayType: 'Friday' },
      { dutyType: 'CDO', dayType: 'PublicHoliday' },
    ]
    expect(hasDuplicateExceptionRows(rows)).toBe(false)
  })
})
