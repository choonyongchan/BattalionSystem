'use client'

import type { Company } from '@/shared/companies'
import { GUARD_DUTY_ROLES, guardRankRule } from '@/shared/guard-duty'
import type { AppSettings } from '@/backend/domain/settings/settings'
import { isRankRangeInvalid } from '@/backend/domain/duty/duty-rules'
import { SectionTitle } from '@/frontend/components/ui/layout'
import SettingsForm from './SettingsForm'
import RankRangePicker from './RankRangePicker'

type FormValues = Pick<AppSettings, 'guard_duty_rank_overrides'>

/** The rule in force for a role: its override, else the default. */
const ruleFor = (v: FormValues, role: string) => guardRankRule(role, v.guard_duty_rank_overrides)!

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
        <div key={role} className="space-y-3 rounded-card border border-hairline p-3">
          <SectionTitle className="mb-0">{role}</SectionTitle>
          <RankRangePicker
            rule={ruleFor(watch(), role)}
            onChange={(rule) => setValue('guard_duty_rank_overrides', { ...watch('guard_duty_rank_overrides'), [role]: rule }, { shouldDirty: true })}
          />
        </div>
      ))}
    </SettingsForm>
  )
}
