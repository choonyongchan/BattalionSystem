'use client'

import type { Company } from '@/shared/companies'
import { AppSettingsSchema, type AppSettings } from '@/backend/domain/settings/settings'
import { isValidTime } from '@/backend/domain/exceptions/exception-validation'
import { Input } from '@/frontend/components/ui/fields'
import { PARADE_TYPES } from '@/frontend/components/parade/parade-ui'
import SettingsForm from './SettingsForm'

type FormValues = Pick<AppSettings, 'parade_times'>

const ParadeTimesSchema = AppSettingsSchema.pick({ parade_times: true }).extend({
  parade_times: AppSettingsSchema.shape.parade_times.refine(
    (times) => Object.values(times).every((t) => isValidTime(t)),
    { message: 'All parade times must be HH:MM' },
  ),
})

/** Settings: first and last parade times. */
export default function ParadeTimesSection({ company, settings }: { company: Company; settings: AppSettings }) {
  return (
    <SettingsForm<FormValues>
      company={company}
      title="Parade Times"
      defaultValues={{ parade_times: settings.parade_times }}
      schema={ParadeTimesSchema}
    >
      {({ register, formState: { errors } }) => (
        <>
          {PARADE_TYPES.map((pt) => (
            <label key={pt} className="flex items-center gap-3 text-sm text-ink-80">
              <span className="flex-1">{pt}</span>
              <Input type="text" inputMode="numeric" placeholder="HH:MM" maxLength={5} className="w-24" {...register(`parade_times.${pt}`)} />
            </label>
          ))}
          {errors.parade_times && <p role="alert" className="text-xs text-danger">{(errors.parade_times as { message?: string }).message}</p>}
        </>
      )}
    </SettingsForm>
  )
}
