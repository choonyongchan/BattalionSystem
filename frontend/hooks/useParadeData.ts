import { useMemo } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import type { Company } from '@/shared/companies'
import { weekDates } from '@/shared/dates'
import { SoldierRepository } from '@/backend/data/repositories/SoldierRepository'
import { ExceptionRepository } from '@/backend/data/repositories/ExceptionRepository'
import { DutyRepository } from '@/backend/data/repositories/DutyRepository'
import { exceptionLinkFields, isOnStrength, isRevoked } from '@/backend/domain/exceptions/active'
import { combine, useDuties, useExceptions, useSoldiers, useWrite } from './queries'

/** Everything the Parade State tab reads and writes, returned by useParadeData. */
export type ParadeData = ReturnType<typeof useParadeData>

/**
 * The nominal roll, live exceptions and the selected week's duties for the Parade State tab,
 * plus the repositories and a write helper that refreshes on success.
 * @param company Company whose data to load.
 * @param date Selected duty date; duties load for its Mon–Sun week.
 */
export function useParadeData(company: Company, date: string) {
  const repos = useMemo(() => ({
    soldiers: new SoldierRepository(company),
    exceptions: new ExceptionRepository(company),
    duties: new DutyRepository(company),
  }), [company])
  const week = weekDates(date)
  const soldiersQ = useSoldiers(company)
  const exceptionsQ = useExceptions(company)
  const dutiesQ = useDuties(company, week[0], week[6])
  const { run, error: writeError } = useWrite(company)
  const { loading, error: loadError } = combine(soldiersQ, exceptionsQ, dutiesQ)

  // Everyone, posted-out included: the report needs them to drop their exceptions (see generateParadeReport)
  const allSoldiers = useMemo(() => soldiersQ.data ?? [], [soldiersQ.data])
  const soldiers = useMemo(() => allSoldiers.filter(isOnStrength), [allSoldiers])
  // Revoked rows count nowhere here; they live on in the soldier's history (SoldierSheet)
  const exceptions = useMemo(() => (exceptionsQ.data ?? []).filter((e) => !isRevoked(e)), [exceptionsQ.data])
  const duties = dutiesQ.data ?? []

  /** Runs a write; on error shows it and returns false, otherwise refreshes and returns true. */
  const mutate = (write: () => PromiseLike<{ error: PostgrestError | null }>): Promise<boolean> => run(write)

  /** Soldier link + type for an exception written for `name` (see exceptionLinkFields). */
  const linkFields = (name: string, scope: string, reason: string | null, currentType?: string | null) =>
    exceptionLinkFields(allSoldiers, name, scope, reason, currentType)

  return { repos, loading, error: writeError ?? loadError, allSoldiers, soldiers, exceptions, duties, mutate, linkFields }
}
