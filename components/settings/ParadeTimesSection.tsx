'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { Company } from '@/lib/companies'
import { AppSettingsSchema } from '@/lib/settings'
import type { AppSettings } from '@/lib/settings'
import { useSaveSettingsMutation } from '@/lib/settings'
import { isValidTime } from '@/lib/exception-validation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

const ParadeTimesSchema = AppSettingsSchema.pick({ parade_times: true }).extend({
  parade_times: AppSettingsSchema.shape.parade_times.refine(
    (times) => Object.values(times).every((t) => isValidTime(t)),
    { message: 'All parade times must be HH:MM' },
  ),
})
type FormValues = { parade_times: Record<string, string> }

const PARADE_TYPES = ['First Parade', 'Last Parade'] as const

export default function ParadeTimesSection({ company, settings }: { company: Company; settings: AppSettings }) {
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(ParadeTimesSchema),
    defaultValues: { parade_times: settings.parade_times },
  })
  const saveMutation = useSaveSettingsMutation(company)

  function onSubmit(values: FormValues) {
    saveMutation.mutate({ parade_times: values.parade_times }, {
      onSuccess: () => toast.success('Parade times saved'),
      onError: () => toast.error('Failed to save parade times'),
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-4">
      {PARADE_TYPES.map((pt) => (
        <div key={pt} className="flex items-center gap-3">
          <Label className="text-sm text-gray-700 flex-1">{pt}</Label>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="HH:MM"
            maxLength={5}
            className="w-24"
            {...register(`parade_times.${pt}`)}
          />
        </div>
      ))}
      {errors.parade_times && (
        <p className="text-xs text-red-600">{(errors.parade_times as { message?: string }).message}</p>
      )}
      <Button type="submit" disabled={saveMutation.isPending || !isDirty}>
        {saveMutation.isPending ? 'Saving…' : 'Save Parade Times'}
      </Button>
    </form>
  )
}
