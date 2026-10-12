'use client'

import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import type { Company } from '@/shared/companies'
import { EXCEPTION_SCOPES } from '@/backend/domain/exceptions/exception-validation'
import type { AppSettings } from '@/backend/domain/settings/settings'
import { useSaveSettingsMutation } from '@/frontend/hooks/useSettings'
import { Switch } from '@/frontend/components/ui/switch'
import { Label } from '@/frontend/components/ui/label'
import { THEME } from '@/frontend/theme'

type FormValues = { absence_scope_defaults: AppSettings['absence_scope_defaults'] }

/** Settings: whether each exception scope counts as absent by default. */
export default function AbsenceDefaultsSection({ company, settings }: { company: Company; settings: AppSettings }) {
  const { watch, setValue, handleSubmit, formState: { isDirty } } = useForm<FormValues>({
    defaultValues: { absence_scope_defaults: settings.absence_scope_defaults },
  })
  const defaults = watch('absence_scope_defaults')
  const saveMutation = useSaveSettingsMutation(company)

  /** Flips one scope's default. */
  function toggle(scope: string, value: boolean) {
    setValue('absence_scope_defaults', { ...defaults, [scope]: value }, { shouldDirty: true })
  }

  /** Saves the absence defaults. */
  function onSubmit(values: FormValues) {
    saveMutation.mutate({ absence_scope_defaults: values.absence_scope_defaults }, {
      onSuccess: () => toast.success('Absence scope defaults saved'),
      onError: () => toast.error('Failed to save absence scope defaults'),
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 pb-4">
      <p className="text-xs text-ink-60">
        Sets the default shown for "Absent?" when a scope is first picked on a new exception —
        does not change existing exceptions.
      </p>
      {EXCEPTION_SCOPES.map((scope) => (
        <div key={scope} className="flex items-center justify-between py-1">
          <Label className="text-sm text-ink-80">{scope}</Label>
          <Switch checked={defaults[scope] ?? false} onCheckedChange={(v) => toggle(scope, v)} />
        </div>
      ))}
      <button
        type="submit"
        disabled={saveMutation.isPending || !isDirty}
        className={`px-4 py-2 rounded-full text-sm font-medium text-white transition-colors ${THEME.buttonBg} ${THEME.buttonHoverBg} disabled:opacity-50`}
      >
        {saveMutation.isPending ? 'Saving…' : 'Save Absence Scope Defaults'}
      </button>
    </form>
  )
}
