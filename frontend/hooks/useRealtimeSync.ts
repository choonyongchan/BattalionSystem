import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Company } from '@/shared/companies'
import { supabase } from '@/backend/data/client'

const TABLES = ['NominalRoll', 'Exceptions', 'Duty', 'Settings', 'OffLeave', 'Conducts', 'ConductDecisions', 'MedicalReviews', 'OverviewMarks']

/** Refetches a company's data whenever any of its tables change on another device. */
// ponytail: invalidates the whole company; narrow to per-table keys if refetch cost shows
export function useRealtimeSync(company: Company) {
  const qc = useQueryClient()
  useEffect(() => {
    const refresh = () => qc.invalidateQueries({ queryKey: [company] })
    let ch = supabase.channel(`sync-${company}`)
    for (const t of TABLES) ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `company=eq.${company}` }, refresh)
    ch.subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [company, qc])
}
