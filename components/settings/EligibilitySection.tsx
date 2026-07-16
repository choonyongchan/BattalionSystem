'use client'

import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import type { Company } from '@/lib/companies'
import { ALL_DUTY_TYPES, RANK_ORDER, DEFAULT_RANK_RULES, COMPANY_THEMES } from '@/lib/companies'
import type { AppSettings } from '@/lib/settings'
import { useSaveSettingsMutation, useNominalRollQuery } from '@/lib/settings'
import { isRankRangeInvalid } from '@/lib/duty/duty-rules'
import SearchDropdown from '@/components/shared/SearchDropdown'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type FormValues = {
  eligibility_name_overrides: AppSettings['eligibility_name_overrides']
  eligibility_rank_overrides: AppSettings['eligibility_rank_overrides']
}

export default function EligibilitySection({ company, settings }: { company: Company; settings: AppSettings }) {
  const theme = COMPANY_THEMES[company]
  const { data: soldiers = [] } = useNominalRollQuery(company)
  const { watch, setValue, handleSubmit, formState: { isDirty } } = useForm<FormValues>({
    defaultValues: {
      eligibility_name_overrides: settings.eligibility_name_overrides,
      eligibility_rank_overrides: settings.eligibility_rank_overrides,
    },
  })
  const nameOverrides = watch('eligibility_name_overrides')
  const rankOverrides = watch('eligibility_rank_overrides')
  const saveMutation = useSaveSettingsMutation(company)

  function addName(dt: string, name: string) {
    if (!name) return
    const existing = nameOverrides[dt] ?? []
    if (existing.includes(name)) return
    setValue('eligibility_name_overrides', { ...nameOverrides, [dt]: [...existing, name] }, { shouldDirty: true })
  }
  function removeName(dt: string, name: string) {
    setValue(
      'eligibility_name_overrides',
      { ...nameOverrides, [dt]: (nameOverrides[dt] ?? []).filter((n) => n !== name) },
      { shouldDirty: true },
    )
  }
  function setRankRule(dt: string, from: string, to: string) {
    setValue('eligibility_rank_overrides', { ...rankOverrides, [dt]: { from, to } }, { shouldDirty: true })
  }

  const invalidDutyTypes = ALL_DUTY_TYPES.filter((dt) =>
    isRankRangeInvalid(rankOverrides[dt] ?? DEFAULT_RANK_RULES[dt] ?? { from: 'REC', to: 'ME8' }),
  )

  function onSubmit(values: FormValues) {
    if (invalidDutyTypes.length > 0) return
    saveMutation.mutate({
      eligibility_name_overrides: values.eligibility_name_overrides,
      eligibility_rank_overrides: values.eligibility_rank_overrides,
    }, {
      onSuccess: () => toast.success('Eligibility overrides saved'),
      onError: () => toast.error('Failed to save eligibility overrides'),
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pb-4">
      <p className="text-xs text-gray-500">
        Precedence: a name-list override (if non-empty) wins; otherwise the rank-range override applies.
      </p>
      {ALL_DUTY_TYPES.map((dt) => {
        const names = nameOverrides[dt] ?? []
        const rule = rankOverrides[dt] ?? DEFAULT_RANK_RULES[dt] ?? { from: 'REC', to: 'ME8' }
        const rangeInvalid = isRankRangeInvalid(rule)
        return (
          <div key={dt} className="border border-gray-200 rounded-xl p-3 space-y-3">
            <p className="text-xs font-bold text-gray-600 uppercase">{dt}</p>

            <div>
              <p className="text-xs text-gray-500 mb-1">Name overrides (takes precedence)</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {names.map((n) => (
                  <span key={n} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-lg">
                    {n}
                    <button type="button" onClick={() => removeName(dt, n)} className="text-gray-400 hover:text-red-500">×</button>
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
                onChange={(name) => addName(dt, name)}
                inputClass="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                placeholder="Add soldier..."
              />
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">Rank-range override</p>
              <div className="flex items-center gap-2">
                <Select value={rule.from} onValueChange={(v) => v && setRankRule(dt, v, rule.to)}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{RANK_ORDER.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
                <span className="text-xs text-gray-400">–</span>
                <Select value={rule.to} onValueChange={(v) => v && setRankRule(dt, rule.from, v)}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{RANK_ORDER.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {rangeInvalid && (
                <p className="text-xs text-red-600 mt-1">&quot;From&quot; rank must not come after &quot;to&quot; rank.</p>
              )}
            </div>
          </div>
        )
      })}
      <button
        type="submit"
        disabled={saveMutation.isPending || !isDirty || invalidDutyTypes.length > 0}
        className={`px-4 py-2 rounded-full text-sm font-medium text-white transition-colors ${theme.buttonBg} ${theme.buttonHoverBg} disabled:opacity-50`}
      >
        {saveMutation.isPending ? 'Saving…' : 'Save Eligibility Overrides'}
      </button>
    </form>
  )
}
