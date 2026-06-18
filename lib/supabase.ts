import { createClient } from '@supabase/supabase-js'
import type { Company } from './companies'

export function getSupabaseClient(company: Company) {
  const upper = company.toUpperCase()
  const url = process.env[`NEXT_PUBLIC_SUPABASE_URL_${upper}`]!
  const key = process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY_${upper}`]!
  return createClient(url, key)
}

export interface Soldier {
  rank: string
  name: string
  platoon: string
}

export interface Exception {
  id: number
  name: string
  scope: string | null
  reason: string | null
  start: string | null
  end: string | null
}

export interface DutyEntry {
  duty_type: string
  date: string
  name: string | null
}

export interface Configuration {
  parade_type: string
  time: string
}
