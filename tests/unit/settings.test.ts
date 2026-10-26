import { describe, it, expect } from 'vitest'
import { AppSettingsSchema, defaultSettings, mergeSettings, pointsDutyTypes, rosterDutyTypes, resolveDayType } from '@/backend/domain/settings/settings'

const DEFAULT_SETTINGS = defaultSettings('test')

const VALID_SETTINGS = {
  ...DEFAULT_SETTINGS,
  duty_base_weights: { CDO: 2, CDS: 1, COS: 1, PDS1: 1, PDS2: 1, PDS3: 1, PDS4: 1 },
  duty_day_multipliers: { MonThurs: 1, Friday: 0.5, Saturday: 2, Sunday: 1.5, PublicHoliday: 2 },
  duty_weight_exceptions: { 'COS:PublicHoliday': 5 },
  eligibility_name_overrides: { CDO: ['LEE JUN WEI'] },
  eligibility_rank_overrides: { COS: { from: 'PTE', to: '3SG' } },
  guard_duty_rank_overrides: { CDOS: { from: '2SG', to: '2SG' } },
  absence_scope_defaults: {
    'Att C': true, 'Off/Leave': true, MA: true,
    Status: false, 'Report Sick': false, Others: false,
  },
  parade_times: { 'First Parade': '09:30', 'Last Parade': '17:30' },
}

describe('AppSettingsSchema', () => {
  it('accepts a fully valid settings object', () => {
    expect(AppSettingsSchema.safeParse(VALID_SETTINGS).success).toBe(true)
  })

  it('rejects duty_day_multipliers missing a required key', () => {
    const bad = { ...VALID_SETTINGS, duty_day_multipliers: { MonThurs: 1, Friday: 0.5 } }
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

describe('defaultSettings', () => {
  it('keeps the old per-company behaviour: Hercules rosters a Duty Clerk, its HQ sits out of conducts, RSI says HQ COY', () => {
    const herc = defaultSettings('hercules')
    expect(rosterDutyTypes(herc)).toEqual(['CDO', 'CDS', 'COS', 'PDS1', 'PDS2', 'PDS3', 'Duty Clerk'])
    expect(pointsDutyTypes(herc).at(-1)).toBe('Guard Duty')
    expect(herc.conducts.include_hq).toBe(false)
    expect(herc.report_sick.header_label).toBe('HQ COY')
    const stallion = defaultSettings('stallion')
    expect(rosterDutyTypes(stallion)).toEqual(['CDO', 'CDS', 'COS', 'PDS1', 'PDS2', 'PDS3', 'PDS4'])
    expect(stallion.conducts.include_hq).toBe(true)
    expect(stallion.report_sick.header_label).toBe('STALLION COY')
  })

  it('every default passes its own schema', () => {
    expect(AppSettingsSchema.safeParse(defaultSettings('hercules')).success).toBe(true)
  })
})

describe('mergeSettings', () => {
  it('falls back per company when a newer column is null', () => {
    expect(mergeSettings({ platoons: null }, 'hercules').platoons.map((p) => p.key)).toEqual(['SIG', 'OPR+ASA', 'MED'])
  })

  it('returns the input unchanged when every field is valid', () => {
    expect(mergeSettings(VALID_SETTINGS, 'test')).toEqual(VALID_SETTINGS)
  })

  it('falls back to DEFAULT_SETTINGS wholesale when given null', () => {
    expect(mergeSettings(null, 'test')).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back to DEFAULT_SETTINGS wholesale when given undefined', () => {
    expect(mergeSettings(undefined, 'test')).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back to DEFAULT_SETTINGS for missing keys in a partial object', () => {
    const result = mergeSettings({}, 'test')
    expect(result).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back per-key: a malformed field is replaced with its default, valid fields are kept', () => {
    const raw = { ...VALID_SETTINGS, duty_base_weights: 'garbage' }
    const result = mergeSettings(raw, 'test')
    expect(result.duty_base_weights).toEqual(DEFAULT_SETTINGS.duty_base_weights)
    expect(result.duty_weight_exceptions).toEqual(VALID_SETTINGS.duty_weight_exceptions)
    expect(result.parade_times).toEqual(VALID_SETTINGS.parade_times)
  })
})

describe('resolveDayType', () => {
  it('returns MonThurs for an ordinary weekday with no holidays', () => {
    // 2026-01-15 is a Thursday
    expect(resolveDayType('2026-01-15', new Set())).toBe('MonThurs')
  })

  it('returns Friday for a Friday not in the holiday set', () => {
    // 2026-01-16 is a Friday
    expect(resolveDayType('2026-01-16', new Set())).toBe('Friday')
  })

  it('returns Saturday for a Saturday not in the holiday set', () => {
    // 2026-01-17 is a Saturday
    expect(resolveDayType('2026-01-17', new Set())).toBe('Saturday')
  })

  it('returns Sunday for a Sunday not in the holiday set', () => {
    // 2026-01-18 is a Sunday
    expect(resolveDayType('2026-01-18', new Set())).toBe('Sunday')
  })

  it('returns PublicHoliday when the date is in the holiday set', () => {
    expect(resolveDayType('2026-01-15', new Set(['2026-01-15']))).toBe('PublicHoliday')
  })

  it('PublicHoliday takes precedence over Friday when a Friday is also a holiday', () => {
    expect(resolveDayType('2026-01-16', new Set(['2026-01-16']))).toBe('PublicHoliday')
  })

  it('PublicHoliday takes precedence over Saturday when a Saturday is also a holiday', () => {
    expect(resolveDayType('2026-01-17', new Set(['2026-01-17']))).toBe('PublicHoliday')
  })

  it('an empty holiday set never matches', () => {
    expect(resolveDayType('2026-01-01', new Set())).not.toBe('PublicHoliday')
  })
})
