'use client'

import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import type { Company } from '@/shared/companies'
import { COMPANY_THEMES, pointsDutyTypes } from '@/shared/companies'
import { DAY_TYPES, DAY_TYPE_LABELS } from '@/backend/domain/settings/settings'
import type { AppSettings, DayType } from '@/backend/domain/settings/settings'
import { useSaveSettingsMutation } from '@/frontend/hooks/useSettings'
import { hasDuplicateExceptionRows } from '@/backend/domain/duty/duty-weights-validation'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/frontend/components/ui/select'

const FormSchema = z.object({
  duty_base_weights: z.record(z.string(), z.number().nonnegative()),
  duty_day_multipliers: z.object({
    MonThurs: z.number().nonnegative(),
    Friday: z.number().nonnegative(),
    Saturday: z.number().nonnegative(),
    Sunday: z.number().nonnegative(),
    PublicHoliday: z.number().nonnegative(),
  }),
  exceptionRows: z.array(z.object({ dutyType: z.string(), dayType: z.enum(DAY_TYPES), points: z.number().nonnegative() })),
}).refine(
  (data) => !hasDuplicateExceptionRows(data.exceptionRows),
  { message: 'Duplicate exception rows for the same duty type and day type are not allowed', path: ['exceptionRows'] }
)
type FormValues = z.infer<typeof FormSchema>

/** Turns stored "duty:dayType" weight overrides into editable rows. */
function exceptionsToRows(exceptions: Record<string, number>): FormValues['exceptionRows'] {
  return Object.entries(exceptions).map(([key, points]) => {
    const [dutyType, dayType] = key.split(':') as [string, DayType]
    return { dutyType, dayType, points }
  })
}

/** Turns edited rows back into "duty:dayType" weight overrides. */
function rowsToExceptions(rows: FormValues['exceptionRows']): Record<string, number> {
  const out: Record<string, number> = {}
  for (const row of rows) out[`${row.dutyType}:${row.dayType}`] = row.points
  return out
}

/** Settings: duty base weights, day multipliers and per-day overrides. */
export default function DutyWeightsSection({ company, settings }: { company: Company; settings: AppSettings }) {
  const theme = COMPANY_THEMES[company]
  const dutyTypes = pointsDutyTypes(company)
  const { register, control, handleSubmit, formState: { isDirty, errors } } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      // A duty type with no stored weight (e.g. Duty Clerk, added later) starts at 1, as computePoints assumes
      duty_base_weights: { ...Object.fromEntries(dutyTypes.map((dt) => [dt, 1])), ...settings.duty_base_weights },
      duty_day_multipliers: settings.duty_day_multipliers,
      exceptionRows: exceptionsToRows(settings.duty_weight_exceptions),
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'exceptionRows' })
  const saveMutation = useSaveSettingsMutation(company)

  /** Saves the duty weight settings. */
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
          {dutyTypes.map((dt) => (
            <div key={dt}>
              <Label className="text-xs text-gray-500 mb-1 block">{dt}</Label>
              <Input type="number" step={0.5} min={0} {...register(`duty_base_weights.${dt}`, { valueAsNumber: true })} />
              {errors.duty_base_weights?.[dt] && (
                <p className="text-xs text-red-600 mt-1">{errors.duty_base_weights[dt]?.message}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs text-gray-500 mb-2 block">Day-type multiplier</Label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {DAY_TYPES.map((day) => (
            <div key={day}>
              <Label className="text-xs text-gray-500 mb-1 block">{DAY_TYPE_LABELS[day]}</Label>
              <Input type="number" step={0.1} min={0} {...register(`duty_day_multipliers.${day}`, { valueAsNumber: true })} />
              {errors.duty_day_multipliers?.[day] && (
                <p className="text-xs text-red-600 mt-1">{errors.duty_day_multipliers[day]?.message}</p>
              )}
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
                      {dutyTypes.map((dt) => <SelectItem key={dt} value={dt}>{dt}</SelectItem>)}
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
              <Input type="number" step={0.5} min={0} className="w-24" {...register(`exceptionRows.${i}.points`, { valueAsNumber: true })} />
              <button type="button" onClick={() => remove(i)} className="text-gray-400 hover:text-red-500">×</button>
              {errors.exceptionRows?.[i]?.points && (
                <p className="text-xs text-red-600">{errors.exceptionRows[i]?.points?.message}</p>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => append({ dutyType: dutyTypes[0], dayType: 'PublicHoliday', points: 1 })}
            className="bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
          >
            + Add exception
          </button>
          {(errors.exceptionRows?.root?.message ?? (errors.exceptionRows as { message?: string } | undefined)?.message) && (
            <p className="text-xs text-red-600">
              {errors.exceptionRows?.root?.message ?? (errors.exceptionRows as { message?: string } | undefined)?.message}
            </p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={saveMutation.isPending || !isDirty}
        className={`px-4 py-2 rounded-full text-sm font-medium text-white transition-colors ${theme.buttonBg} ${theme.buttonHoverBg} disabled:opacity-50`}
      >
        {saveMutation.isPending ? 'Saving…' : 'Save Duty Weights'}
      </button>
    </form>
  )
}
