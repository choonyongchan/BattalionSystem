import { createClient } from '@supabase/supabase-js'
import type { Company } from '@/shared/companies'
import { companyLabel } from '@/shared/companies'

type NominalRollTable = {
  Row:           { id: string; rank: string; name: string; platoon: string; four_d: string | null; on_strength: boolean }
  Insert:        { id?: string; rank: string; name: string; platoon: string; four_d?: string | null; on_strength?: boolean }
  Update:        { id?: string; rank?: string; name?: string; platoon?: string; four_d?: string | null; on_strength?: boolean }
  Relationships: []
}
type ExceptionsTable = {
  Row:           { id: number; name: string; scope: string; reason: string | null; start: string | null; end: string | null; counts_as_absence: boolean; time?: string | null; location?: string | null; in_out?: string | null; soldier_id: string | null; type: string | null; revoked_at: string | null }
  Insert:        { id?: number; name: string; scope: string; reason?: string | null; start?: string | null; end?: string | null; counts_as_absence?: boolean; time?: string | null; location?: string | null; in_out?: string | null; soldier_id?: string | null; type?: string | null; revoked_at?: string | null }
  Update:        { id?: number; name?: string; scope?: string; reason?: string | null; start?: string | null; end?: string | null; counts_as_absence?: boolean; time?: string | null; location?: string | null; in_out?: string | null; soldier_id?: string | null; type?: string | null; revoked_at?: string | null }
  Relationships: []
}
type DutyTable = {
  Row:           { duty_type: string; date: string; name: string }
  Insert:        { duty_type: string; date: string; name: string }
  Update:        { duty_type?: string; date?: string; name?: string }
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

type OffLeaveTable = {
  Row:           { name: string; off: number; leave: number }
  Insert:        { name: string; off?: number; leave?: number }
  Update:        { name?: string; off?: number; leave?: number }
  Relationships: []
}

type ConductsTable = {
  Row:           { id: string; name: string; date: string; end_date: string | null; start_time: string | null; end_time: string | null; created_at: string }
  Insert:        { id?: string; name: string; date: string; end_date?: string | null; start_time?: string | null; end_time?: string | null }
  Update:        { name?: string; date?: string; end_date?: string | null; start_time?: string | null; end_time?: string | null }
  Relationships: []
}

type ConductDecisionsTable = {
  Row:           { id: string; conduct_id: string; soldier_id: string; participating: boolean; reason: string | null; created_at: string }
  Insert:        { id?: string; conduct_id: string; soldier_id: string; participating: boolean; reason?: string | null }
  Update:        { participating?: boolean; reason?: string | null }
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
  { [C in Company as `${Capitalize<C>}_Settings`]:      SettingsTable    } &
  { [C in Company as `${Capitalize<C>}_OffLeave`]:      OffLeaveTable    } &
  { [C in Company as `${Capitalize<C>}_Conducts`]:      ConductsTable    } &
  { [C in Company as `${Capitalize<C>}_ConductDecisions`]: ConductDecisionsTable }

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

/**
 * Full table name for a company, e.g. tbl("hercules", "Duty") -> "Hercules_Duty".
 * ponytail: any cast — Supabase can't narrow dynamic table names; cast results at call sites
 */
export const tbl = (company: Company, table: string) =>
  `${companyLabel(company)}_${table}` as any
