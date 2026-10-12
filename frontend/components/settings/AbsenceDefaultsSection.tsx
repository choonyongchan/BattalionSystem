'use client'

import type { Company } from '@/shared/companies'
import { EXCEPTION_SCOPES } from '@/backend/domain/exceptions/exception-validation'
import type { AppSettings } from '@/backend/domain/settings/settings'
import { Switch } from '@/frontend/components/ui/switch'
import { Label } from '@/frontend/components/ui/label'
import SettingsForm from './SettingsForm'

/** Settings: whether each exception scope counts as absent by default. */
export default function AbsenceDefaultsSection({ company, settings }: { company: Company; settings: AppSettings }) {
  return (
    <SettingsForm<Pick<AppSettings, 'absence_scope_defaults'>>
      company={company}
      title="Absence Scope Defaults"
      description={'Sets the default shown for "Absent?" when a scope is first picked on a new exception; does not change existing exceptions.'}
      defaultValues={{ absence_scope_defaults: settings.absence_scope_defaults }}
    >
      {({ watch, setValue }) => EXCEPTION_SCOPES.map((scope) => (
        <div key={scope} className="flex items-center justify-between py-1">
          <Label className="text-sm text-ink-80">{scope}</Label>
          <Switch
            checked={watch('absence_scope_defaults')[scope] ?? false}
            onCheckedChange={(v) => setValue('absence_scope_defaults', { ...watch('absence_scope_defaults'), [scope]: v }, { shouldDirty: true })}
          />
        </div>
      ))}
    </SettingsForm>
  )
}
