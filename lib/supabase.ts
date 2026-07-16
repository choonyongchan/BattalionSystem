import { createClient } from '@supabase/supabase-js'
import type { Company } from './companies'
import { companyLabel } from './companies'

type NominalRollTable = {
  Row:           { rank: string; name: string; platoon: string; four_d: string | null }
  Insert:        { rank: string; name: string; platoon: string; four_d?: string | null }
  Update:        { rank?: string; name?: string; platoon?: string; four_d?: string | null }
  Relationships: []
}
type ExceptionsTable = {
  Row:           { id: number; name: string; scope: string; reason: string | null; start: string | null; end: string | null; counts_as_absence: boolean; time?: string | null }
  Insert:        { id?: number; name: string; scope: string; reason?: string | null; start?: string | null; end?: string | null; counts_as_absence?: boolean; time?: string | null }
  Update:        { id?: number; name?: string; scope?: string; reason?: string | null; start?: string | null; end?: string | null; counts_as_absence?: boolean; time?: string | null }
  Relationships: []
}
type DutyTable = {
  Row:           { duty_type: string; date: string; name: string }
  Insert:        { duty_type: string; date: string; name: string }
  Update:        { duty_type?: string; date?: string; name?: string }
  Relationships: []
}
// @deprecated — superseded by the new Settings table (see SettingsTable below) and
// lib/settings.ts. Kept only because the live Configuration table still exists; application
// code should not write new data through this type.
type ConfigTable = {
  Row:           { parade_type: string; time: string }
  Insert:        { parade_type: string; time: string }
  Update:        { parade_type?: string; time?: string }
  Relationships: []
}

type SettingsTable = {
  Row: {
    id: number
    duty_base_weights: Record<string, number>
    duty_day_multipliers: Record<string, number>
    duty_weight_exceptions: Record<string, number>
    eligibility_name_overrides: Record<string, string[]>
    eligibility_rank_overrides: Record<string, { from: string; to: string }>
    guard_duty_rank_overrides: Record<string, { from: string; to: string }>
    absence_scope_defaults: Record<string, boolean>
    parade_times: Record<string, string>
  }
  Insert: {
    id?: number
    duty_base_weights?: Record<string, number>
    duty_day_multipliers?: Record<string, number>
    duty_weight_exceptions?: Record<string, number>
    eligibility_name_overrides?: Record<string, string[]>
    eligibility_rank_overrides?: Record<string, { from: string; to: string }>
    guard_duty_rank_overrides?: Record<string, { from: string; to: string }>
    absence_scope_defaults?: Record<string, boolean>
    parade_times?: Record<string, string>
  }
  Update: {
    id?: number
    duty_base_weights?: Record<string, number>
    duty_day_multipliers?: Record<string, number>
    duty_weight_exceptions?: Record<string, number>
    eligibility_name_overrides?: Record<string, string[]>
    eligibility_rank_overrides?: Record<string, { from: string; to: string }>
    guard_duty_rank_overrides?: Record<string, { from: string; to: string }>
    absence_scope_defaults?: Record<string, boolean>
    parade_times?: Record<string, string>
  }
  Relationships: []
}

type PublicHolidaysTable = {
  Row:           { date: string; name: string }
  Insert:        { date: string; name?: string }
  Update:        { date?: string; name?: string }
  Relationships: []
}

type CompanyTables =
  { [C in Company as `${Capitalize<C>}_NominalRoll`]:   NominalRollTable } &
  { [C in Company as `${Capitalize<C>}_Exceptions`]:    ExceptionsTable  } &
  { [C in Company as `${Capitalize<C>}_Duty`]:          DutyTable        } &
  { [C in Company as `${Capitalize<C>}_Configuration`]: ConfigTable      } &
  { [C in Company as `${Capitalize<C>}_Settings`]:      SettingsTable    }

type Database = {
  public: {
    Tables: CompanyTables & { PublicHolidays: PublicHolidaysTable }
    Views:     Record<string, never>
    Functions: Record<string, never>
  }
}

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
)

// ponytail: any cast — Supabase can't narrow dynamic table names; cast results at call sites
export const tbl = (company: Company, table: string) =>
  `${companyLabel(company)}_${table}` as any

export interface Soldier {
  rank: string
  name: string
  platoon: string
  four_d?: string | null
}

export interface Exception {
  id: number
  name: string
  scope: string
  reason: string | null
  start: string | null
  end: string | null
  counts_as_absence: boolean
  time?: string | null
}

export interface DutyEntry {
  duty_type: string
  date: string
  name: string
}

// @deprecated — superseded by the new Settings table and lib/settings.ts. Kept only because
// the live Configuration table still exists; application code should not write new data
// through this type.
export interface Configuration {
  parade_type: string
  time: string
}

export function displayName(name: string, soldiers: Soldier[]): string {
  const rank = soldiers.find(s => s.name === name)?.rank
  return rank ? `${rank} ${name}` : name
}
