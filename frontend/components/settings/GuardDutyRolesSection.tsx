'use client'

import type { Company } from '@/shared/companies'
import { GUARD_DUTY_ROLES, DEFAULT_GUARD_DUTY_RANK_RULES } from '@/shared/ranks'
import type { AppSettings } from '@/backend/domain/settings/settings'
import { isRankRangeInvalid } from '@/backend/domain/duty/duty-rules'
import SettingsForm from './SettingsForm'
import RankRangePicker from './RankRangePicker'

type FormValues = Pick<AppSettings, 'guard_duty_rank_overrides'>

/** The rule in force for a role: its override, else the default. */
const ruleFor = (v: FormValues, role: string) => v.guard_duty_rank_overrides[role] ?? DEFAULT_GUARD_DUTY_RANK_RULES[role]

/** Settings: rank range allowed for each guard duty role. */
export default function GuardDutyRolesSection({ company, settings }: { company: Company; settings: AppSettings }) {
  return (
    <SettingsForm<FormValues>
      company={company}
      title="Guard Duty Roles"
      description="Restrict which ranks may be assigned to each Guard Duty role."
      defaultValues={{ guard_duty_rank_overrides: settings.guard_duty_rank_overrides }}
      invalid={(v) => GUARD_DUTY_ROLES.some((role) => isRankRangeInvalid(ruleFor(v, role)))}
    >
      {({ watch, setValue }) => GUARD_DUTY_ROLES.map((role) => (
        <div key={role} className="border border-hairline rounded-lg p-3 space-y-3">
          <p className="text-sm font-semibold text-ink">{role}</p>
          <RankRangePicker
            rule={ruleFor(watch(), role)}
            onChange={(rule) => setValue('guard_duty_rank_overrides', { ...watch('guard_duty_rank_overrides'), [role]: rule }, { shouldDirty: true })}
          />
        </div>
      ))}
    </SettingsForm>
  )
}
