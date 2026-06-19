import { createClient } from '@supabase/supabase-js'
import type { Company } from './companies'

const SUPABASE_CONFIGS: Record<Company, { url: string; key: string }> = {
  archer:   { url: process.env.NEXT_PUBLIC_SUPABASE_URL_ARCHER!,   key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_ARCHER! },
  braves:   { url: process.env.NEXT_PUBLIC_SUPABASE_URL_BRAVES!,   key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_BRAVES! },
  cougar:   { url: process.env.NEXT_PUBLIC_SUPABASE_URL_COUGAR!,   key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_COUGAR! },
  stallion: { url: process.env.NEXT_PUBLIC_SUPABASE_URL_STALLION!, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_STALLION! },
  hercules: { url: process.env.NEXT_PUBLIC_SUPABASE_URL_HERCULES!, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_HERCULES! },
}

export function getSupabaseClient(company: Company) {
  const { url, key } = SUPABASE_CONFIGS[company]
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
