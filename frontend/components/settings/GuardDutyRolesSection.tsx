'use client'

import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import type { Company } from '@/shared/companies'
import { GUARD_DUTY_ROLES, RANK_ORDER, DEFAULT_GUARD_DUTY_RANK_RULES } from '@/shared/ranks'
import type { AppSettings } from '@/backend/domain/settings/settings'
import { useSaveSettingsMutation } from '@/frontend/hooks/useSettings'
import { isRankRangeInvalid } from '@/backend/domain/duty/duty-rules'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/frontend/components/ui/select'
import { THEME } from '@/frontend/theme'

type FormValues = {
  guard_duty_rank_overrides: AppSettings['guard_duty_rank_overrides']
}

/** Settings: rank range allowed for each guard duty role. */
export default function GuardDutyRolesSection({ company, settings }: { company: Company; settings: AppSettings }) {
  const { watch, setValue, handleSubmit, formState: { isDirty } } = useForm<FormValues>({
    defaultValues: {
      guard_duty_rank_overrides: settings.guard_duty_rank_overrides,
    },
  })
  const rankOverrides = watch('guard_duty_rank_overrides')
  const saveMutation = useSaveSettingsMutation(company)

  /** Sets one end of a role's rank range. */
  function setRankRule(role: string, from: string, to: string) {
    setValue('guard_duty_rank_overrides', { ...rankOverrides, [role]: { from, to } }, { shouldDirty: true })
  }

  const invalidRoles = GUARD_DUTY_ROLES.filter((role) =>
    isRankRangeInvalid(rankOverrides[role] ?? DEFAULT_GUARD_DUTY_RANK_RULES[role]),
  )

  /** Saves the guard duty rank ranges. */
  function onSubmit(values: FormValues) {
    if (invalidRoles.length > 0) return
    saveMutation.mutate({
      guard_duty_rank_overrides: values.guard_duty_rank_overrides,
    }, {
      onSuccess: () => toast.success('Guard Duty roles saved'),
      onError: () => toast.error('Failed to save Guard Duty roles'),
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pb-4">
      <p className="text-xs text-ink-60">
        Restrict which ranks may be assigned to each Guard Duty role.
      </p>
      {GUARD_DUTY_ROLES.map((role) => {
        const rule = rankOverrides[role] ?? DEFAULT_GUARD_DUTY_RANK_RULES[role]
        const rangeInvalid = isRankRangeInvalid(rule)
        return (
          <div key={role} className="border border-hairline rounded-lg p-3 space-y-3">
            <p className="text-sm font-semibold text-ink">{role}</p>
            <div className="flex items-center gap-2">
              <Select value={rule.from} onValueChange={(v) => v && setRankRule(role, v, rule.to)}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>{RANK_ORDER.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
              <span className="text-xs text-ink-60">–</span>
              <Select value={rule.to} onValueChange={(v) => v && setRankRule(role, rule.from, v)}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>{RANK_ORDER.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {rangeInvalid && (
              <p className="text-xs text-danger mt-1">&quot;From&quot; rank must not come after &quot;to&quot; rank.</p>
            )}
          </div>
        )
      })}
      <button
        type="submit"
        disabled={saveMutation.isPending || !isDirty || invalidRoles.length > 0}
        className={`px-4 py-2 rounded-full text-sm font-medium text-white transition-colors ${THEME.buttonBg} ${THEME.buttonHoverBg} disabled:opacity-50`}
      >
        {saveMutation.isPending ? 'Saving…' : 'Save Guard Duty Roles'}
      </button>
    </form>
  )
}
