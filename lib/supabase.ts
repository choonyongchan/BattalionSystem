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
type ConfigTable = {
  Row:           { parade_type: string; time: string }
  Insert:        { parade_type: string; time: string }
  Update:        { parade_type?: string; time?: string }
  Relationships: []
}

type CompanyTables =
  { [C in Company as `${Capitalize<C>}_NominalRoll`]:   NominalRollTable } &
  { [C in Company as `${Capitalize<C>}_Exceptions`]:    ExceptionsTable  } &
  { [C in Company as `${Capitalize<C>}_Duty`]:          DutyTable        } &
  { [C in Company as `${Capitalize<C>}_Configuration`]: ConfigTable      }

type Database = {
  public: {
    Tables:    CompanyTables
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

export interface Configuration {
  parade_type: string
  time: string
}

export function displayName(name: string, soldiers: Soldier[]): string {
  const rank = soldiers.find(s => s.name === name)?.rank
  return rank ? `${rank} ${name}` : name
}
