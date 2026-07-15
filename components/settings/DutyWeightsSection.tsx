'use client'

import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import type { Company } from '@/lib/companies'
import { ALL_DUTY_TYPES } from '@/lib/companies'
import { AppSettingsSchema, DAY_TYPES } from '@/lib/settings'
import type { AppSettings, DayType } from '@/lib/settings'
import { useSaveSettingsMutation } from '@/lib/settings'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const FormSchema = z.object({
  duty_base_weights: AppSettingsSchema.shape.duty_base_weights,
  duty_day_multipliers: AppSettingsSchema.shape.duty_day_multipliers,
  exceptionRows: z.array(z.object({ dutyType: z.string(), dayType: z.enum(DAY_TYPES), points: z.number() })),
})
type FormValues = z.infer<typeof FormSchema>

function exceptionsToRows(exceptions: Record<string, number>): FormValues['exceptionRows'] {
  return Object.entries(exceptions).map(([key, points]) => {
    const [dutyType, dayType] = key.split(':') as [string, DayType]
    return { dutyType, dayType, points }
  })
}

function rowsToExceptions(rows: FormValues['exceptionRows']): Record<string, number> {
  const out: Record<string, number> = {}
  for (const row of rows) out[`${row.dutyType}:${row.dayType}`] = row.points
  return out
}

export default function DutyWeightsSection({ company, settings }: { company: Company; settings: AppSettings }) {
  const { register, control, handleSubmit, formState: { isDirty } } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      duty_base_weights: settings.duty_base_weights,
      duty_day_multipliers: settings.duty_day_multipliers,
      exceptionRows: exceptionsToRows(settings.duty_weight_exceptions),
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'exceptionRows' })
  const saveMutation = useSaveSettingsMutation(company)

  function onSubmit(values: FormValues) {
    saveMutation.mutate({
      duty_base_weights: values.duty_base_weights,
      duty_day_multipliers: values.duty_day_multipliers,
      duty_weight_exceptions: rowsToExceptions(values.exceptionRows),
    }, {
      onSuccess: () => toast.success('Duty weights saved'),
      onError: () => toast.error('Failed to save duty weights'),
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-4">
      <p className="text-xs text-gray-500">Points awarded per duty type. A day multiplier applies on top; an exception below overrides both.</p>

      <div>
        <Label className="text-xs text-gray-500 mb-2 block">Base weight per duty type</Label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {ALL_DUTY_TYPES.map((dt) => (
            <div key={dt}>
              <Label className="text-xs text-gray-500 mb-1 block">{dt}</Label>
              <Input type="number" step={0.5} min={0} {...register(`duty_base_weights.${dt}`, { valueAsNumber: true })} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs text-gray-500 mb-2 block">Day-type multiplier</Label>
        <div className="grid grid-cols-3 gap-3">
          {DAY_TYPES.map((day) => (
            <div key={day}>
              <Label className="text-xs text-gray-500 mb-1 block">{day}</Label>
              <Input type="number" step={0.1} min={0} {...register(`duty_day_multipliers.${day}`, { valueAsNumber: true })} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs text-gray-500 mb-2 block">Exceptions (exact override, wins over the formula)</Label>
        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={field.id} className="flex items-center gap-2">
              <Controller
                control={control}
                name={`exceptionRows.${i}.dutyType`}
                render={({ field: ctrlField }) => (
                  <Select value={ctrlField.value} onValueChange={ctrlField.onChange}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Duty type" /></SelectTrigger>
                    <SelectContent>
                      {ALL_DUTY_TYPES.map((dt) => <SelectItem key={dt} value={dt}>{dt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
              <Controller
                control={control}
                name={`exceptionRows.${i}.dayType`}
                render={({ field: ctrlField }) => (
                  <Select value={ctrlField.value} onValueChange={ctrlField.onChange}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Day type" /></SelectTrigger>
                    <SelectContent>
                      {DAY_TYPES.map((day) => <SelectItem key={day} value={day}>{day}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
              <Input type="number" step={0.5} className="w-24" {...register(`exceptionRows.${i}.points`, { valueAsNumber: true })} />
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>×</Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => append({ dutyType: ALL_DUTY_TYPES[0], dayType: 'PublicHoliday', points: 1 })}>
            + Add exception
          </Button>
        </div>
      </div>

      <Button type="submit" disabled={saveMutation.isPending || !isDirty}>
        {saveMutation.isPending ? 'Saving…' : 'Save Duty Weights'}
      </Button>
    </form>
  )
}
