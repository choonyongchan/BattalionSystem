import { describe, it, expect } from 'vitest'
import { AppSettingsSchema, DEFAULT_SETTINGS, mergeSettings } from '@/lib/settings'

const VALID_SETTINGS = {
  duty_base_weights: { CDO: 2, CDS: 1, COS: 1, PDS1: 1, PDS2: 1, PDS3: 1, PDS4: 1 },
  duty_day_multipliers: { Normal: 1, Friday: 0.5, PublicHoliday: 2 },
  duty_weight_exceptions: { 'COS:PublicHoliday': 5 },
  eligibility_name_overrides: { CDO: ['LEE JUN WEI'] },
  eligibility_rank_overrides: { COS: { from: 'PTE', to: '3SG' } },
  absence_scope_defaults: {
    'Att C': true, 'Off/Leave': true, MA: true,
    Status: false, 'Guard Duty': false, 'Report Sick': false, Others: false,
  },
  parade_times: { 'First Parade': '09:30', 'Last Parade': '17:30' },
}

describe('AppSettingsSchema', () => {
  it('accepts a fully valid settings object', () => {
    expect(AppSettingsSchema.safeParse(VALID_SETTINGS).success).toBe(true)
  })

  it('rejects duty_day_multipliers missing a required key', () => {
    const bad = { ...VALID_SETTINGS, duty_day_multipliers: { Normal: 1, Friday: 0.5 } }
    expect(AppSettingsSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects duty_base_weights that is not a record of numbers', () => {
    const bad = { ...VALID_SETTINGS, duty_base_weights: 'not-an-object' }
    expect(AppSettingsSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects eligibility_rank_overrides with a malformed rule shape', () => {
    const bad = { ...VALID_SETTINGS, eligibility_rank_overrides: { COS: { from: 'PTE' } } }
    expect(AppSettingsSchema.safeParse(bad).success).toBe(false)
  })
})

describe('mergeSettings', () => {
  it('returns the input unchanged when every field is valid', () => {
    expect(mergeSettings(VALID_SETTINGS)).toEqual(VALID_SETTINGS)
  })

  it('falls back to DEFAULT_SETTINGS wholesale when given null', () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back to DEFAULT_SETTINGS wholesale when given undefined', () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back to DEFAULT_SETTINGS for missing keys in a partial object', () => {
    const result = mergeSettings({})
    expect(result).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back per-key: a malformed field is replaced with its default, valid fields are kept', () => {
    const raw = { ...VALID_SETTINGS, duty_base_weights: 'garbage' }
    const result = mergeSettings(raw)
    expect(result.duty_base_weights).toEqual(DEFAULT_SETTINGS.duty_base_weights)
    expect(result.duty_weight_exceptions).toEqual(VALID_SETTINGS.duty_weight_exceptions)
    expect(result.parade_times).toEqual(VALID_SETTINGS.parade_times)
  })
})
