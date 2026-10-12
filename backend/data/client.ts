import { createClient } from '@supabase/supabase-js'
import type { Company } from '@/shared/companies'
import { companyLabel } from '@/shared/companies'

/** Any table: per-company tables are typed by the repositories that cast their rows to shared/types. */
type AnyTable = { Row: Record<string, any>; Insert: Record<string, any>; Update: Record<string, any>; Relationships: [] }

type Database = {
  public: {
    Tables: Record<string, AnyTable> & {
      PublicHolidays: {
        Row: { date: string; name: string }
        Insert: { date: string; name?: string }
        Update: { date?: string; name?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
)

/**
 * Full table name for a company, e.g. tbl("hercules", "Duty") -> "Hercules_Duty".
 * ponytail: any cast, Supabase can't narrow dynamic table names; repositories cast results to shared/types
 */
export const tbl = (company: Company, table: string) =>
  `${companyLabel(company)}_${table}` as any
