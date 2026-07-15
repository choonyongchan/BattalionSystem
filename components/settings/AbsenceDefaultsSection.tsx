'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { Company } from '@/lib/companies'
import { EXCEPTION_SCOPES } from '@/lib/exception-validation'
import type { AppSettings } from '@/lib/settings'
import { useSaveSettingsMutation } from '@/lib/settings'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function AbsenceDefaultsSection({ company, settings }: { company: Company; settings: AppSettings }) {
  const [defaults, setDefaults] = useState(settings.absence_scope_defaults)
  const saveMutation = useSaveSettingsMutation(company)

  function toggle(scope: string, value: boolean) {
    setDefaults((prev) => ({ ...prev, [scope]: value }))
  }

  function save() {
    saveMutation.mutate({ absence_scope_defaults: defaults }, {
      onSuccess: () => toast.success('Absence scope defaults saved'),
      onError: () => toast.error('Failed to save absence scope defaults'),
    })
  }

  return (
    <div className="space-y-3 pb-4">
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
      <Button type="button" onClick={save} disabled={saveMutation.isPending}>
        {saveMutation.isPending ? 'Saving…' : 'Save Absence Scope Defaults'}
      </Button>
    </div>
  )
}
