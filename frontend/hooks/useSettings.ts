import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Company } from '@/shared/companies'
import type { AppSettings } from '@/backend/domain/settings/settings'
import { SettingsRepository } from '@/backend/data/repositories/SettingsRepository'
import { PublicHolidayRepository } from '@/backend/data/repositories/PublicHolidayRepository'
import { SoldierRepository } from '@/backend/data/repositories/SoldierRepository'

const holidays = new PublicHolidayRepository()

/** Fetches a company's settings (cached under ['settings', company]). */
export function useSettingsQuery(company: Company) {
  return useQuery({ queryKey: ['settings', company], queryFn: () => new SettingsRepository(company).load() })
}

/** Saves settings fields and refreshes the settings query. */
export function useSaveSettingsMutation(company: Company) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (partial: Partial<AppSettings>) => new SettingsRepository(company).save(partial),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', company] }),
  })
}

/** Fetches a company's nominal roll for settings screens; empty on error. */
export function useNominalRollQuery(company: Company) {
  return useQuery({
    queryKey: ['nominalRoll', company],
    queryFn: async () => (await new SoldierRepository(company).list()).data,
  })
}

/** Fetches all public holidays. */
export function usePublicHolidaysQuery() {
  return useQuery({ queryKey: ['publicHolidays'], queryFn: () => holidays.list() })
}

/** Adds a public holiday and refreshes the holiday query. */
export function useAddHolidayMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ date, name }: { date: string; name: string }) => holidays.add(date, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['publicHolidays'] }),
  })
}

/** Removes a public holiday and refreshes the holiday query. */
export function useRemoveHolidayMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (date: string) => holidays.remove(date),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['publicHolidays'] }),
  })
}
