'use client'

import { useFieldArray, type UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import type { Company } from '@/shared/companies'
import { DAY_TYPES, DAY_TYPE_LABELS, pointsDutyTypes } from '@/backend/domain/settings/settings'
import type { AppSettings, DayType } from '@/backend/domain/settings/settings'
import { hasDuplicateExceptionRows } from '@/backend/domain/duty/duty-weights-validation'
import { Button } from '@/frontend/components/ui/button'
import { Field, Input, Select } from '@/frontend/components/ui/fields'
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
      <fieldset>
        <legend className="mb-2 text-xs text-ink-60">Base weight per duty type</legend>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {dutyTypes.map((dt) => (
            <Field key={dt} label={dt} error={errors.duty_base_weights?.[dt]?.message}>
              <Input type="number" step={0.5} min={0} {...register(`duty_base_weights.${dt}`, { valueAsNumber: true })} />
            </Field>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs text-ink-60">Day-type multiplier</legend>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {DAY_TYPES.map((day) => (
            <Field key={day} label={DAY_TYPE_LABELS[day]} error={errors.duty_day_multipliers?.[day]?.message}>
              <Input type="number" step={0.1} min={0} {...register(`duty_day_multipliers.${day}`, { valueAsNumber: true })} />
            </Field>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs text-ink-60">Exceptions (exact override, wins over the formula)</legend>
        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={field.id} className="flex flex-wrap items-center gap-2">
              <Select aria-label="Duty type" className="w-auto flex-1" {...register(`exceptionRows.${i}.dutyType`)}>
                {dutyTypes.map((dt) => <option key={dt} value={dt}>{dt}</option>)}
              </Select>
              <Select aria-label="Day type" className="w-auto flex-1" {...register(`exceptionRows.${i}.dayType`)}>
                {DAY_TYPES.map((day) => <option key={day} value={day}>{day}</option>)}
              </Select>
              <Input aria-label="Points" type="number" step={0.5} min={0} className="w-24" {...register(`exceptionRows.${i}.points`, { valueAsNumber: true })} />
              <Button type="button" variant="icon-danger" aria-label="Remove exception" title="Remove exception" onClick={() => remove(i)}>✕</Button>
              {errors.exceptionRows?.[i]?.points && (
                <p role="alert" className="text-xs text-danger">{errors.exceptionRows[i]?.points?.message}</p>
              )}
            </div>
          ))}
          <Button type="button" variant="soft" onClick={() => append({ dutyType: dutyTypes[0], dayType: 'PublicHoliday', points: 1 })}>
            + Add exception
          </Button>
          {(errors.exceptionRows?.root?.message ?? (errors.exceptionRows as { message?: string } | undefined)?.message) && (
            <p role="alert" className="text-xs text-danger">
              {errors.exceptionRows?.root?.message ?? (errors.exceptionRows as { message?: string } | undefined)?.message}
            </p>
          )}
        </div>
      </fieldset>
    </>
  )
}