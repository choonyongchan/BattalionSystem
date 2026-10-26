import { createClient } from '@supabase/supabase-js'

/** Any table: rows are typed by the repositories that cast them to shared/types. */
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
