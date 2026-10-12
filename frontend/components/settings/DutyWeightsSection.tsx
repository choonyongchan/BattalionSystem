'use client'

import { useFieldArray, Controller, type UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import type { Company } from '@/shared/companies'
import { DAY_TYPES, DAY_TYPE_LABELS, pointsDutyTypes } from '@/backend/domain/settings/settings'
import type { AppSettings, DayType } from '@/backend/domain/settings/settings'
import { hasDuplicateExceptionRows } from '@/backend/domain/duty/duty-weights-validation'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/frontend/components/ui/select'
import SettingsForm from './SettingsForm'

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
  const dutyTypes = pointsDutyTypes(settings)
  return (
    <SettingsForm<FormValues>
      company={company}
      title="Duty Weights"
      description="Points awarded per duty type. A day multiplier applies on top; an exception below overrides both."
      schema={FormSchema}
      defaultValues={{
        // A duty type with no stored weight (e.g. one added later) starts at 1, as computePoints assumes
        duty_base_weights: { ...Object.fromEntries(dutyTypes.map((dt) => [dt, 1])), ...settings.duty_base_weights },
        duty_day_multipliers: settings.duty_day_multipliers,
        exceptionRows: exceptionsToRows(settings.duty_weight_exceptions),
      }}
      toSettings={(v) => ({
        duty_base_weights: v.duty_base_weights,
        duty_day_multipliers: v.duty_day_multipliers,
        duty_weight_exceptions: rowsToExceptions(v.exceptionRows),
      })}
    >
      {(form) => <WeightFields form={form} dutyTypes={dutyTypes} />}
    </SettingsForm>
  )
}

/** The weight inputs; a component of its own so useFieldArray runs inside the form. */
function WeightFields({ form, dutyTypes }: { form: UseFormReturn<FormValues>; dutyTypes: string[] }) {
  const { register, control, formState: { errors } } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'exceptionRows' })
  return (
    <>
      <div>
        <Label className="text-xs text-ink-60 mb-2 block">Base weight per duty type</Label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {dutyTypes.map((dt) => (
            <div key={dt}>
              <Label className="text-xs text-ink-60 mb-1 block">{dt}</Label>
              <Input type="number" step={0.5} min={0} {...register(`duty_base_weights.${dt}`, { valueAsNumber: true })} />
              {errors.duty_base_weights?.[dt] && (
                <p className="text-xs text-danger mt-1">{errors.duty_base_weights[dt]?.message}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs text-ink-60 mb-2 block">Day-type multiplier</Label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {DAY_TYPES.map((day) => (
            <div key={day}>
              <Label className="text-xs text-ink-60 mb-1 block">{DAY_TYPE_LABELS[day]}</Label>
              <Input type="number" step={0.1} min={0} {...register(`duty_day_multipliers.${day}`, { valueAsNumber: true })} />
              {errors.duty_day_multipliers?.[day] && (
                <p className="text-xs text-danger mt-1">{errors.duty_day_multipliers[day]?.message}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs text-ink-60 mb-2 block">Exceptions (exact override, wins over the formula)</Label>
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
              <button type="button" onClick={() => remove(i)} className="text-ink-60 hover:text-danger">×</button>
              {errors.exceptionRows?.[i]?.points && (
                <p className="text-xs text-danger">{errors.exceptionRows[i]?.points?.message}</p>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => append({ dutyType: dutyTypes[0], dayType: 'PublicHoliday', points: 1 })}
            className="bg-parchment text-ink-80 hover:bg-hairline rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
          >
            + Add exception
          </button>
          {(errors.exceptionRows?.root?.message ?? (errors.exceptionRows as { message?: string } | undefined)?.message) && (
            <p className="text-xs text-danger">
              {errors.exceptionRows?.root?.message ?? (errors.exceptionRows as { message?: string } | undefined)?.message}
            </p>
          )}
        </div>
      </div>
    </>
  )
}