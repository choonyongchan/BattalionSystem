import { createClient } from '@supabase/supabase-js'
import type { Company } from './companies'
import { companyLabel } from './companies'

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
  { [C in Company as `${Capitalize<C>}_Configuration`]: ConfigTable      } &
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

// ponytail: any cast — Supabase can't narrow dynamic table names; cast results at call sites
export const tbl = (company: Company, table: string) =>
  `${companyLabel(company)}_${table}` as any

export interface Soldier {
  /** Stable id — exceptions and conduct decisions point here, so a rename keeps them. Absent in older fixtures. */
  id?: string
  rank: string
  name: string
  platoon: string
  four_d?: string | null
  /** false = posted out: hidden from strength and the roll, history kept. Absent = on strength. */
  on_strength?: boolean
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
  location?: string | null
  in_out?: 'IN' | 'OUT' | null
  /** The soldier it belongs to. Null for rows written before the id existed or by the old app — see soldierKey(). */
  soldier_id?: string | null
  /** Fine-grained kind (MC, LD, RMJ, Excuse, ...); scope is the parade section it prints under. Null = infer (exceptionType). */
  type?: string | null
  /** Set = taken back: counts nowhere, but stays on the soldier's history. */
  revoked_at?: string | null
}

export interface Conduct {
  id: string
  name: string
  /** Start date. */
  date: string
  /** Null = within the start day. */
  end_date: string | null
  /** "HH:MM:SS", or null when no timing has been issued. */
  start_time: string | null
  end_time: string | null
}

/** A manual participation call — auto fall-outs are derived from Exceptions and never stored. */
export interface ConductDecision {
  id: string
  conduct_id: string
  soldier_id: string
  participating: boolean
  reason: string | null
}

export interface OffLeave {
  name: string
  off: number
  leave: number
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

// Duties that allow two names (e.g. "JOSHUA / CHOONYONG") store them joined by this separator.
export const DUTY_NAME_SEP = ' / '

// Sentinel name for a duty partner who is outside the nominal roll (e.g. a second Duty Clerk
// borrowed from another unit). Stored like a normal duty name so the roll soldier still gets
// their usual point share, but it's stripped from the Parade State output text.
export const EXTERNAL_DUTY_PERSON = '<EXTERNAL>'

export function splitDutyNames(name: string): string[] {
  return name.split(DUTY_NAME_SEP).map((n) => n.trim()).filter((n) => n !== '')
}

function displayOneName(name: string, soldiers: Soldier[]): string {
  const rank = soldiers.find(s => s.name === name)?.rank
  return rank ? `${rank} ${name}` : name
}

export function displayName(name: string, soldiers: Soldier[]): string {
  return splitDutyNames(name).map((n) => displayOneName(n, soldiers)).join(DUTY_NAME_SEP)
}

// Like displayName, but for duty entries: omits an EXTERNAL_DUTY_PERSON partner from the
// printed Parade State text (used only for internal record-keeping/points, not shown to reader).
export function displayDutyName(name: string, soldiers: Soldier[]): string {
  const filtered = splitDutyNames(name).filter((n) => n !== EXTERNAL_DUTY_PERSON).join(DUTY_NAME_SEP)
  return displayName(filtered, soldiers)
}
