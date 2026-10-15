import { useState } from 'react'
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import type { PostgrestError } from '@supabase/supabase-js'
import type { Company } from '@/shared/companies'
import type { ListResult } from '@/backend/data/repositories/CompanyRepository'
import type { AppSettings } from '@/backend/domain/settings/settings'
import { SettingsRepository } from '@/backend/data/repositories/SettingsRepository'
import { PublicHolidayRepository } from '@/backend/data/repositories/PublicHolidayRepository'
import { SoldierRepository } from '@/backend/data/repositories/SoldierRepository'
import { ExceptionRepository } from '@/backend/data/repositories/ExceptionRepository'
import { DutyRepository } from '@/backend/data/repositories/DutyRepository'
import { ConductRepository } from '@/backend/data/repositories/ConductRepository'
import { OverviewMarkRepository } from '@/backend/data/repositories/OverviewMarkRepository'
import { OffLeaveRepository } from '@/backend/data/repositories/OffLeaveRepository'
import { MedicalReviewRepository } from '@/backend/data/repositories/MedicalReviewRepository'

// Every company query is keyed [company, ...], so one write refreshes all of that company's data.

/** Rows of one company query; a Supabase error becomes the query's error. */
function useRows<T>(company: Company, key: unknown[], list: () => Promise<ListResult<T>>) {
  return useQuery({
    queryKey: [company, ...key],
    queryFn: async () => {
      const { data, error } = await list()
      if (error) throw error
      return data
    },
  })
}

/** The whole nominal roll, posted-out included. */
export const useSoldiers = (company: Company) => useRows(company, ['soldiers'], () => new SoldierRepository(company).list(true))

/** Every exception, revoked included; pass a scope to load only that scope. */
export const useExceptions = (company: Company, scope?: string) =>
  useRows(company, ['exceptions', scope], () => new ExceptionRepository(company).list(scope))

/** Duties dated within [from, to], or all duties when both are omitted. */
export const useDuties = (company: Company, from?: string, to?: string) =>
  useRows(company, ['duties', from, to], () => new DutyRepository(company).list(from, to))

/** Conducts by date. */
export const useConducts = (company: Company) => useRows(company, ['conducts'], () => new ConductRepository(company).list())

/** Every manual conduct participation call. */
export const useConductDecisions = (company: Company) =>
  useRows(company, ['conductDecisions'], () => new ConductRepository(company).listDecisions())

/** Shared Overview marks for one date. */
export const useOverviewMarks = (company: Company, date: string) =>
  useRows(company, ['overviewMarks', date], () => new OverviewMarkRepository(company).list(date))

/** Off and leave balances. */
export const useOffLeave = (company: Company) => useRows(company, ['offLeave'], () => new OffLeaveRepository(company).list())

/** Medical review details. */
export const useMedicalReviews = (company: Company) =>
  useRows(company, ['medicalReviews'], () => new MedicalReviewRepository(company).list())

/** Loading while any query loads; the first query error's message, if any. */
export function combine(...queries: UseQueryResult[]): { loading: boolean; error: string | null } {
  return {
    loading: queries.some((q) => q.isLoading),
    error: (queries.find((q) => q.error)?.error as { message?: string } | undefined)?.message ?? null,
  }
}

/** Refetches all of a company's data, for children that write through repositories themselves. */
export function useRefresh(company: Company) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: [company] })
}

/**
 * Runs writes for a company: tracks busy, keeps the last error, and refreshes the company's
 * data after a success. `run` resolves true on success.
 */
export function useWrite(company: Company) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Runs one write; on success refetches the company's data. */
  async function run(write: () => PromiseLike<{ error: PostgrestError | { message: string } | null }>): Promise<boolean> {
    setBusy(true)
    setError(null)
    const { error } = await write()
    if (error) setError(error.message)
    else await qc.invalidateQueries({ queryKey: [company] })
    setBusy(false)
    return !error
  }

  return { run, busy, error, setError }
}

/** A company's settings, merged over its defaults. */
export const useSettingsQuery = (company: Company) =>
  useQuery({ queryKey: [company, 'settings'], queryFn: () => new SettingsRepository(company).load() })

/** Saves settings fields; every open tab picks the change up. */
export function useSaveSettingsMutation(company: Company) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (partial: Partial<AppSettings>) => new SettingsRepository(company).save(partial),
    onSuccess: () => qc.invalidateQueries({ queryKey: [company, 'settings'] }),
  })
}

const holidays = new PublicHolidayRepository()

/** All public holidays (shared by every company). */
export const usePublicHolidaysQuery = () => useQuery({ queryKey: ['publicHolidays'], queryFn: () => holidays.list() })

/** Adds or removes a public holiday and refreshes the holiday list. */
function useHolidayMutation<V>(fn: (v: V) => Promise<void>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['publicHolidays'] }) })
}

/** Adds (or renames) a public holiday. */
export const useAddHolidayMutation = () => useHolidayMutation(({ date, name }: { date: string; name: string }) => holidays.add(date, name))

/** Removes a public holiday. */
export const useRemoveHolidayMutation = () => useHolidayMutation((date: string) => holidays.remove(date))
