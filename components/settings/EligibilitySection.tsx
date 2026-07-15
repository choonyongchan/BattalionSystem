'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase, tbl } from '@/lib/supabase'
import type { Soldier } from '@/lib/supabase'
import type { Company } from '@/lib/companies'
import { ALL_DUTY_TYPES, RANK_ORDER, DEFAULT_RANK_RULES } from '@/lib/companies'
import type { AppSettings } from '@/lib/settings'
import { useSaveSettingsMutation } from '@/lib/settings'
import SearchDropdown from '@/components/SearchDropdown'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

// A from-rank that sorts after the to-rank in RANK_ORDER produces a rank range that matches
// zero soldiers (see lib/duty-rules.ts's isInRange) — that's a silent footgun rather than a
// crash, so it's caught here and surfaced as a blocking inline error instead of being saved.
function isRankRangeInvalid(rule: { from: string; to: string }): boolean {
  const fi = RANK_ORDER.indexOf(rule.from)
  const ti = RANK_ORDER.indexOf(rule.to)
  return fi === -1 || ti === -1 || fi > ti
}

export default function EligibilitySection({ company, settings }: { company: Company; settings: AppSettings }) {
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [nameOverrides, setNameOverrides] = useState(settings.eligibility_name_overrides)
  const [rankOverrides, setRankOverrides] = useState(settings.eligibility_rank_overrides)
  const saveMutation = useSaveSettingsMutation(company)

  useEffect(() => {
    supabase.from(tbl(company, 'NominalRoll')).select('*').then(({ data }) => setSoldiers((data ?? []) as unknown as Soldier[]))
  }, [company])

  function addName(dt: string, name: string) {
    if (!name) return
    setNameOverrides((prev) => {
      const existing = prev[dt] ?? []
      if (existing.includes(name)) return prev
      return { ...prev, [dt]: [...existing, name] }
    })
  }
  function removeName(dt: string, name: string) {
    setNameOverrides((prev) => ({ ...prev, [dt]: (prev[dt] ?? []).filter((n) => n !== name) }))
  }
  function setRankRule(dt: string, from: string, to: string) {
    setRankOverrides((prev) => ({ ...prev, [dt]: { from, to } }))
  }

  const invalidDutyTypes = ALL_DUTY_TYPES.filter((dt) =>
    isRankRangeInvalid(rankOverrides[dt] ?? DEFAULT_RANK_RULES[dt] ?? { from: 'REC', to: 'ME8' }),
  )

  function save() {
    if (invalidDutyTypes.length > 0) return
    saveMutation.mutate({
      eligibility_name_overrides: nameOverrides,
      eligibility_rank_overrides: rankOverrides,
    }, {
      onSuccess: () => toast.success('Eligibility overrides saved'),
      onError: () => toast.error('Failed to save eligibility overrides'),
    })
  }

  return (
    <div className="space-y-5 pb-4">
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
      <Button type="button" onClick={save} disabled={saveMutation.isPending || invalidDutyTypes.length > 0}>
        {saveMutation.isPending ? 'Saving…' : 'Save Eligibility Overrides'}
      </Button>
    </div>
  )
}
