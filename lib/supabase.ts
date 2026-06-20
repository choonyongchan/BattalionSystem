import { createClient } from '@supabase/supabase-js'
import type { Company } from './companies'

type Database = {
  public: {
    Tables: {
      NominalRoll: {
        Row:           { rank: string; name: string; platoon: string }
        Insert:        { rank: string; name: string; platoon: string }
        Update:        { rank?: string; name?: string; platoon?: string }
        Relationships: []
      }
      Exceptions: {
        Row:           { id: number; name: string; scope: string; reason: string; start: string; end: string }
        Insert:        { id?: number; name: string; scope: string; reason: string; start: string; end: string }
        Update:        { id?: number; name?: string; scope?: string; reason?: string; start?: string; end?: string }
        Relationships: []
      }
      Duty: {
        Row:           { duty_type: string; date: string; name: string }
        Insert:        { duty_type: string; date: string; name: string }
        Update:        { duty_type?: string; date?: string; name?: string }
        Relationships: []
      }
      Configuration: {
        Row:           { parade_type: string; time: string }
        Insert:        { parade_type: string; time: string }
        Update:        { parade_type?: string; time?: string }
        Relationships: []
      }
    }
    Views:     Record<string, never>
    Functions: Record<string, never>
  }
}

const SUPABASE_CONFIGS: Record<Company, { url: string; key: string }> = {
  archer:   { url: process.env.NEXT_PUBLIC_ARCHER_SUPABASE_URL!,   key: process.env.NEXT_PUBLIC_ARCHER_SUPABASE_PUBLISHABLE_KEY! },
  braves:   { url: process.env.NEXT_PUBLIC_BRAVES_SUPABASE_URL!,   key: process.env.NEXT_PUBLIC_BRAVES_SUPABASE_PUBLISHABLE_KEY! },
  cougar:   { url: process.env.NEXT_PUBLIC_COUGAR_SUPABASE_URL!,   key: process.env.NEXT_PUBLIC_COUGAR_SUPABASE_PUBLISHABLE_KEY! },
  stallion: { url: process.env.NEXT_PUBLIC_STALLION_SUPABASE_URL!, key: process.env.NEXT_PUBLIC_STALLION_SUPABASE_PUBLISHABLE_KEY! },
  hercules: { url: process.env.NEXT_PUBLIC_HERCULES_SUPABASE_URL!, key: process.env.NEXT_PUBLIC_HERCULES_SUPABASE_PUBLISHABLE_KEY! },
}

const clients = new Map<Company, ReturnType<typeof createClient<Database>>>()

export function getSupabaseClient(company: Company) {
  if (!clients.has(company)) {
    const { url, key } = SUPABASE_CONFIGS[company]
    clients.set(company, createClient<Database>(url, key))
  }
  return clients.get(company)!
}

export interface Soldier {
  rank: string
  name: string
  platoon: string
}

export interface Exception {
  id: number
  name: string
  scope: string
  reason: string
  start: string
  end: string
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
