'use client'

import type { Company } from '@/shared/companies'
import { EXCEPTION_SCOPES } from '@/backend/domain/exceptions/exception-validation'
import type { AppSettings } from '@/backend/domain/settings/settings'
import { Switch } from '@/frontend/components/ui/fields'
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
        <label key={scope} className="flex min-h-11 items-center justify-between text-sm text-ink-80">
          {scope}
          <Switch
            checked={watch('absence_scope_defaults')[scope] ?? false}
            onChange={(e) => setValue('absence_scope_defaults', { ...watch('absence_scope_defaults'), [scope]: e.target.checked }, { shouldDirty: true })}
          />
        </label>
      ))}
    </SettingsForm>
  )
}
