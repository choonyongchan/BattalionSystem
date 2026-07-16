'use client'

import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import type { Company } from '@/lib/companies'
import { COMPANY_THEMES } from '@/lib/companies'
import { EXCEPTION_SCOPES } from '@/lib/exceptions/exception-validation'
import type { AppSettings } from '@/lib/settings'
import { useSaveSettingsMutation } from '@/lib/settings'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

type FormValues = { absence_scope_defaults: AppSettings['absence_scope_defaults'] }

export default function AbsenceDefaultsSection({ company, settings }: { company: Company; settings: AppSettings }) {
  const theme = COMPANY_THEMES[company]
  const { watch, setValue, handleSubmit, formState: { isDirty } } = useForm<FormValues>({
    defaultValues: { absence_scope_defaults: settings.absence_scope_defaults },
  })
  const defaults = watch('absence_scope_defaults')
  const saveMutation = useSaveSettingsMutation(company)

  function toggle(scope: string, value: boolean) {
    setValue('absence_scope_defaults', { ...defaults, [scope]: value }, { shouldDirty: true })
  }

  function onSubmit(values: FormValues) {
    saveMutation.mutate({ absence_scope_defaults: values.absence_scope_defaults }, {
      onSuccess: () => toast.success('Absence scope defaults saved'),
      onError: () => toast.error('Failed to save absence scope defaults'),
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 pb-4">
      <p className="text-xs text-gray-500">
        Sets the default shown for "Absent?" when a scope is first picked on a new exception —
        does not change existing exceptions.
      </p>
      {EXCEPTION_SCOPES.map((scope) => (
        <div key={scope} className="flex items-center justify-between py-1">
          <Label className="text-sm text-gray-700">{scope}</Label>
          <Switch checked={defaults[scope] ?? false} onCheckedChange={(v) => toggle(scope, v)} />
        </div>
      ))}
      <button
        type="submit"
        disabled={saveMutation.isPending || !isDirty}
        className={`px-4 py-2 rounded-full text-sm font-medium text-white transition-colors ${theme.buttonBg} ${theme.buttonHoverBg} disabled:opacity-50`}
      >
        {saveMutation.isPending ? 'Saving…' : 'Save Absence Scope Defaults'}
      </button>
    </form>
  )
}
