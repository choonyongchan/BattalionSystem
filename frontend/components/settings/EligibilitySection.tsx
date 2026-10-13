'use client'

import type { Company } from '@/shared/companies'
import { rosterDutyTypes, type AppSettings } from '@/backend/domain/settings/settings'
import { useSoldiers } from '@/frontend/hooks/queries'
import { isRankRangeInvalid, rankRuleFor } from '@/backend/domain/duty/duty-rules'
import { isOnStrength } from '@/backend/domain/exceptions/active'
import SearchDropdown from '@/frontend/components/shared/SearchDropdown'
import { soldierDropdownProps } from '@/frontend/components/parade/parade-ui'
import { inputClass } from '@/frontend/components/ui/fields'
import { Chip, SectionTitle } from '@/frontend/components/ui/layout'
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
            <div key={dt} className="space-y-3 rounded-card border border-hairline p-3">
              <SectionTitle className="mb-0">{dt}</SectionTitle>
              <fieldset>
                <legend className="mb-1 text-xs text-ink-60">Name overrides (takes precedence)</legend>
                <div className="mb-2 flex flex-wrap gap-1">
                  {names.map((n) => (
                    <Chip key={n} removeLabel={`Remove ${n}`} onRemove={() => setNames(dt, names.filter((x) => x !== n))}>{n}</Chip>
                  ))}
                </div>
                <SearchDropdown
                  {...soldierDropdownProps}
                  key={`${dt}-${names.length}`}
                  items={soldiers}
                  value=""
                  onChange={(name) => name && !names.includes(name) && setNames(dt, [...names, name])}
                  inputClass={inputClass()}
                  placeholder="Add soldier..."
                />
              </fieldset>
              <fieldset>
                <legend className="mb-1 text-xs text-ink-60">Rank range</legend>
                <RankRangePicker
                  rule={rankRuleFor(dt, rankOverrides)}
                  onChange={(rule) => setValue('eligibility_rank_overrides', { ...rankOverrides, [dt]: rule }, { shouldDirty: true })}
                />
              </fieldset>
            </div>
          )
        })
      }}
    </SettingsForm>
  )
}
