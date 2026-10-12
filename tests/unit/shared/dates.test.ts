import { describe, it, expect } from 'vitest'
import { ddmmyy, offsetDate, pad2, startOfWeek, weekDates } from '@/shared/dates'

describe('date helpers', () => {
  it('offsetDate moves by whole days across month ends', () => {
    expect(offsetDate('2026-01-31', 1)).toBe('2026-02-01')
    expect(offsetDate('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('startOfWeek is the Monday on or before the date, Sunday included', () => {
    expect(startOfWeek('2026-01-15')).toBe('2026-01-12') // Thu
    expect(startOfWeek('2026-01-18')).toBe('2026-01-12') // Sun belongs to the week before it
    expect(startOfWeek('2026-01-12')).toBe('2026-01-12') // Mon
  })

  it('weekDates lists Mon..Sun', () => {
    const week = weekDates('2026-01-15')
    expect(week).toHaveLength(7)
    expect([week[0], week[6]]).toEqual(['2026-01-12', '2026-01-18'])
  })

  it('ddmmyy and pad2 format report fields', () => {
    expect(ddmmyy('2026-03-05')).toBe('050326')
    expect(pad2(7)).toBe('07')
    expect(pad2(12)).toBe('12')
  })
})
