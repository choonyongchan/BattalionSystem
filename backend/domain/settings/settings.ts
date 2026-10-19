import z from 'zod'
import { isFriday, isSaturday, isSunday, parseISO } from 'date-fns'
import type { Company, PlatoonBlock } from '@/shared/companies'

export const DAY_TYPES = ['MonThurs', 'Friday', 'Saturday', 'Sunday', 'PublicHoliday'] as const
export type DayType = (typeof DAY_TYPES)[number]

/** Short label per day type for settings tables. */
export const DAY_TYPE_LABELS: Record<DayType, string> = {
  MonThurs: 'Mon-Thurs',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
  PublicHoliday: 'PH',
}

/** Duties every company rosters, before its per-platoon PDS duties. */
export const BASE_DUTY_TYPES = ['CDO', 'CDS', 'COS'] as const

const RankRuleSchema = z.object({ from: z.string(), to: z.string() })

/**
 * One jsonb column per field on "<Company>_Settings". Columns added after the first release
 * carry no SQL default: a null column falls back to defaultSettings(company), so defaults live here only.
 */
export const AppSettingsSchema = z.object({
  duty_base_weights: z.record(z.string(), z.number()),
  duty_day_multipliers: z.object({
    MonThurs: z.number(),
    Friday: z.number(),
    Saturday: z.number(),
    Sunday: z.number(),
    PublicHoliday: z.number(),
  }),
  duty_weight_exceptions: z.record(z.string(), z.number()),
  eligibility_name_overrides: z.record(z.string(), z.array(z.string())),
  eligibility_rank_overrides: z.record(z.string(), RankRuleSchema),
  guard_duty_rank_overrides: z.record(z.string(), RankRuleSchema),
  absence_scope_defaults: z.record(z.string(), z.boolean()),
  /** Scopes whose parade-state lines end IN or OUT (OUT when counted absent). */
  in_out_scopes: z.array(z.string()),
  parade_times: z.record(z.string(), z.string()),
  /** Parade-state blocks after COY HQ, in print order; PDS1..n follow this order. */
  platoons: z.array(z.object({ key: z.string().min(1), label: z.string().min(1), pdsLabel: z.string().min(1) })).min(1),
  /** Rostered duties beyond CDO/CDS/COS/PDSn, e.g. Duty Clerk. */
  extra_duty_types: z.array(z.string().min(1)),
  /** Duties that take two names, splitting the points. */
  multi_name_duty_types: z.array(z.string()),
  report_sick: z.object({
    /** Company name in the RSI message header, e.g. "HQ COY". */
    header_label: z.string().min(1),
    /** Location prefilled for a new RSI. */
    default_location: z.string(),
    /** Words in a reason that pre-tick URTI. */
    urti_keywords: z.array(z.string().min(1)),
  }),
  conducts: z.object({
    /** Whether COY HQ is counted and listed in conducts. */
    include_hq: z.boolean(),
    /** Exception types that keep a soldier out of a conduct until a commander decides. */
    needs_call_types: z.array(z.string()),
  }),
  overview: z.object({
    /** First words of the bunk strength message, e.g. "STRENGTH CAA". */
    message_title: z.string().min(1),
    /** Scopes that keep a soldier out of the bunk even when not counted absent. */
    out_scopes: z.array(z.string()),
    /** Parade picked when the Overview tab opens. */
  }),
})

export type AppSettings = z.infer<typeof AppSettingsSchema>

/** Builds platoon blocks from [label, PDS label, key?] tuples; key defaults to the 1-based index. */
const blocks = (entries: [label: string, pdsLabel: string, key?: string][]): PlatoonBlock[] =>
  entries.map(([label, pdsLabel, key], i) => ({ key: key ?? String(i + 1), label, pdsLabel: `PDS ${pdsLabel}` }))

/** Each company's platoons before anyone edits them in Settings. */
const DEFAULT_PLATOONS: Record<Company, PlatoonBlock[]> = {
  archer:   blocks([['PL 1', '1'], ['PL 2', '2'], ['PL 3', '3']]),
  braves:   blocks([['PL 4', '4'], ['PL 5', '5'], ['PL 6', '6']]),
  cougar:   blocks([['PL 7', '7'], ['PL 8', '8'], ['PL 9', '9']]),
  stallion: blocks([['PNR', 'PNR'], ['SCR', 'SCR'], ['MTR', 'MTR'], ['SIG', 'SIG']]),
  hercules: blocks([['SIG', 'SIG', 'SIG'], ['OPR+ASA', 'OPR+ASA', 'OPR+ASA'], ['MED', 'MED', 'MED']]),
  test:     blocks([['PL 1', '1'], ['PL 2', '2'], ['PL 3', '3']]),
}

/**
 * A company's settings before anyone edits them. The first eight fields mirror the SQL
 * column DEFAULTs in supabase/schema.sql; keep those in step by hand.
 */
export function defaultSettings(company: Company): AppSettings {
  // Hercules is the battalion's HQ company: it rosters a Duty Clerk and its HQ sits out of conducts
  const hq = company === 'hercules'
  return {
    duty_base_weights: { CDO: 1, CDS: 1, COS: 1, PDS1: 1, PDS2: 1, PDS3: 1, PDS4: 1, 'Guard Duty': 1 },
    duty_day_multipliers: { MonThurs: 1, Friday: 1.5, Saturday: 2, Sunday: 1.5, PublicHoliday: 2 },
    duty_weight_exceptions: {},
    eligibility_name_overrides: {},
    eligibility_rank_overrides: {},
    guard_duty_rank_overrides: {},
    absence_scope_defaults: {
      'Att C': true,
      'Off/Leave': true,
      MA: true,
      Status: false,
      'Guard Duty': false,
      'Report Sick': false,
      Others: false,
    },
    in_out_scopes: ['Att C', 'Report Sick', 'MA', 'Others'],
    parade_times: { 'First Parade': '09:30', 'Last Parade': '17:30' },
    platoons: DEFAULT_PLATOONS[company],
    extra_duty_types: hq ? ['Duty Clerk'] : [],
    multi_name_duty_types: ['COS', 'Duty Clerk'],
    report_sick: {
      header_label: hq ? 'HQ COY' : `${company.toUpperCase()} COY`,
      default_location: 'KHMC',
      urti_keywords: ['urti', 'flu', 'cough', 'coughs', 'coughing', 'sore throat', 'phlegm', 'runny nose', 'blocked nose', 'sneeze', 'sneezing', 'fever', 'cold'],
    },
    conducts: { include_hq: !hq, needs_call_types: ['LD', 'RMJ'] },
    overview: { message_title: 'CURRENT STRENGTH CAA', out_scopes: ['Others', 'Guard Duty'] },
  }
}

/**
 * Validates a raw (possibly null, legacy or corrupted) settings row field by field, falling
 * back to the company's default per top-level field so one bad column can't break the rest.
 */
export function mergeSettings(raw: Partial<Record<keyof AppSettings, unknown>> | null | undefined, company: Company): AppSettings {
  const defaults = defaultSettings(company)
  const merged = {} as Record<string, unknown>
  for (const key of Object.keys(defaults) as (keyof AppSettings)[]) {
    const result = AppSettingsSchema.shape[key].safeParse(raw?.[key])
    merged[key] = result.success ? result.data : defaults[key]
  }
  return merged as AppSettings
}

/** Duties the company rosters: CDO, CDS, COS, one PDS per platoon, then its extra duties. */
export const rosterDutyTypes = (s: AppSettings): string[] =>
  [...BASE_DUTY_TYPES, ...s.platoons.map((_, i) => `PDS${i + 1}`), ...s.extra_duty_types]

/** Duties that earn points: the roster, then Guard Duty (kept in Exceptions). */
export const pointsDutyTypes = (s: AppSettings): string[] => [...rosterDutyTypes(s), 'Guard Duty']

/** Single source of truth for day-type classification. */
export function resolveDayType(dateISO: string, holidays: Set<string>): DayType {
  if (holidays.has(dateISO)) return 'PublicHoliday'
  const date = parseISO(dateISO)
  if (isSaturday(date)) return 'Saturday'
  if (isSunday(date)) return 'Sunday'
  if (isFriday(date)) return 'Friday'
  return 'MonThurs'
}

/** A gazetted public holiday, shared by every company. */
export interface PublicHoliday {
  date: string
  name: string
}
