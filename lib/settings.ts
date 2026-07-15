import z from 'zod'
import { isFriday, parseISO } from 'date-fns'

export const DAY_TYPES = ['Normal', 'Friday', 'PublicHoliday'] as const
export type DayType = (typeof DAY_TYPES)[number]

const RankRuleSchema = z.object({ from: z.string(), to: z.string() })

// Mirrors the jsonb columns on "<Company>_Settings" in supabase/schema.sql — keep the two
// in sync manually; there is no automated check that they match.
export const AppSettingsSchema = z.object({
  duty_base_weights: z.record(z.string(), z.number()),
  duty_day_multipliers: z.object({
    Normal: z.number(),
    Friday: z.number(),
    PublicHoliday: z.number(),
  }),
  duty_weight_exceptions: z.record(z.string(), z.number()),
  eligibility_name_overrides: z.record(z.string(), z.array(z.string())),
  eligibility_rank_overrides: z.record(z.string(), RankRuleSchema),
  absence_scope_defaults: z.record(z.string(), z.boolean()),
  parade_times: z.record(z.string(), z.string()),
})

export type AppSettings = z.infer<typeof AppSettingsSchema>

// Mirrors the SQL column DEFAULTs in supabase/schema.sql's "<Company>_Settings" table —
// keep in sync manually.
export const DEFAULT_SETTINGS: AppSettings = {
  duty_base_weights: { CDO: 1, CDS: 1, COS: 1, PDS1: 1, PDS2: 1, PDS3: 1, PDS4: 1 },
  duty_day_multipliers: { Normal: 1, Friday: 0.5, PublicHoliday: 2 },
  duty_weight_exceptions: {},
  eligibility_name_overrides: {},
  eligibility_rank_overrides: {},
  absence_scope_defaults: {
    'Att C': true,
    'Off/Leave': true,
    MA: true,
    Status: false,
    'Guard Duty': false,
    'Report Sick': false,
    Others: false,
  },
  parade_times: { 'First Parade': '09:30', 'Last Parade': '17:30' },
}

/**
 * Validates a raw (possibly corrupted/legacy) settings object field-by-field against
 * AppSettingsSchema, falling back to DEFAULT_SETTINGS on a per-top-level-key basis so a
 * single malformed jsonb column doesn't take down the whole settings object.
 */
export function mergeSettings(raw: Partial<Record<keyof AppSettings, unknown>> | null | undefined): AppSettings {
  const merged = {} as AppSettings
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
    const shapeSchema = AppSettingsSchema.shape[key]
    const result = shapeSchema.safeParse(raw?.[key])
    ;(merged as Record<string, unknown>)[key] = result.success ? result.data : DEFAULT_SETTINGS[key]
  }
  return merged
}

/** Single source of truth for day-type classification, reused by lib/duty-dashboard.ts. */
export function resolveDayType(dateISO: string, holidays: Set<string>): DayType {
  if (holidays.has(dateISO)) return 'PublicHoliday'
  if (isFriday(parseISO(dateISO))) return 'Friday'
  return 'Normal'
}
