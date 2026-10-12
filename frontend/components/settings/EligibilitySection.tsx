'use client'

import type { Company } from '@/shared/companies'
import { rosterDutyTypes, type AppSettings } from '@/backend/domain/settings/settings'
import { useSoldiers } from '@/frontend/hooks/queries'
import { isRankRangeInvalid, rankRuleFor } from '@/backend/domain/duty/duty-rules'
import { isOnStrength } from '@/backend/domain/exceptions/active'
import SearchDropdown from '@/frontend/components/shared/SearchDropdown'
import SettingsForm from './SettingsForm'
import RankRangePicker from './RankRangePicker'

type FormValues = Pick<AppSettings, 'eligibility_name_overrides' | 'eligibility_rank_overrides'>

/** Settings: who may do each rostered duty, by rank range and named overrides. */
export default function EligibilitySection({ company, settings }: { company: Company; settings: AppSettings }) {
  const soldiers = (useSoldiers(company).data ?? []).filter(isOnStrength)
  const dutyTypes = rosterDutyTypes(settings)

  return (
    <SettingsForm<FormValues>
      company={company}
      title="Eligibility Overrides"
      description="Precedence: a name-list override (if non-empty) wins; otherwise the rank range applies."
      defaultValues={{
        eligibility_name_overrides: settings.eligibility_name_overrides,
        eligibility_rank_overrides: settings.eligibility_rank_overrides,
      }}
      invalid={(v) => dutyTypes.some((dt) => isRankRangeInvalid(rankRuleFor(dt, v.eligibility_rank_overrides)))}
    >
      {({ watch, setValue }) => {
        const nameOverrides = watch('eligibility_name_overrides')
        const rankOverrides = watch('eligibility_rank_overrides')
        /** Replaces one duty's name override list. */
        const setNames = (dt: string, names: string[]) =>
          setValue('eligibility_name_overrides', { ...nameOverrides, [dt]: names }, { shouldDirty: true })
        return dutyTypes.map((dt) => {
          const names = nameOverrides[dt] ?? []
          return (
            <div key={dt} className="border border-hairline rounded-lg p-3 space-y-3">
              <p className="text-sm font-semibold text-ink">{dt}</p>
              <div>
                <p className="text-xs text-ink-60 mb-1">Name overrides (takes precedence)</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {names.map((n) => (
                    <span key={n} className="inline-flex items-center gap-1 bg-parchment text-ink-80 text-xs px-2 py-1 rounded-lg">
                      {n}
                      <button type="button" onClick={() => setNames(dt, names.filter((x) => x !== n))} className="text-ink-60 hover:text-danger">×</button>
                    </span>
                  ))}
                </div>
                <SearchDropdown
                  key={`${dt}-${names.length}`}
                  items={soldiers}
                  value=""
                  getKey={(s) => s.name}
                  getLabel={(s) => `${s.rank} ${s.name}`}
                  matches={(s, q) => `${s.rank} ${s.name}`.toLowerCase().includes(q.toLowerCase())}
                  renderOption={(s) => <span>{s.rank} {s.name}</span>}
                  onChange={(name) => name && !names.includes(name) && setNames(dt, [...names, name])}
                  inputClass="w-full border border-hairline rounded-lg px-3 py-2 text-sm"
                  placeholder="Add soldier..."
                />
              </div>
              <div>
                <p className="text-xs text-ink-60 mb-1">Rank range</p>
                <RankRangePicker
                  rule={rankRuleFor(dt, rankOverrides)}
                  onChange={(rule) => setValue('eligibility_rank_overrides', { ...rankOverrides, [dt]: rule }, { shouldDirty: true })}
                />
              </div>
            </div>
          )
        })
      }}
    </SettingsForm>
  )
}
