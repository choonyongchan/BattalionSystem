import type { Company } from '@/shared/companies'
import { supabase } from './client'

/** Returns the Supabase login email shared by a company's commanders; RLS matches on it. */
export function commanderEmail(company: Company): string {
  return `${company}@40sar.internal`
}

/** Signs in as a company's commander account; resolves to the auth error, or null. */
export async function signInCommander(company: Company, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: commanderEmail(company), password })
  return error
}
