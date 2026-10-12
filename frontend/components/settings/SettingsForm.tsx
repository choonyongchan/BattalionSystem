'use client'

import type { ReactNode } from 'react'
import { useForm, type DefaultValues, type FieldValues, type Resolver, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { toast } from 'sonner'
import type { Company } from '@/shared/companies'
import type { AppSettings } from '@/backend/domain/settings/settings'
import { useSaveSettingsMutation } from '@/frontend/hooks/queries'
import { THEME } from '@/frontend/theme'

/**
 * One settings section: owns the form, the save, its toasts and the Save button, so a
 * section only renders its fields.
 * @param title Names the section in the button and toasts, e.g. "Parade Times".
 * @param toSettings Maps form values to the settings fields to save; defaults to the values as is.
 * @param invalid Blocks saving, for checks the schema can't express.
 */
export default function SettingsForm<V extends FieldValues>({ company, title, description, defaultValues, schema, toSettings, invalid, children }: {
  company: Company
  title: string
  description?: ReactNode
  defaultValues: V
  schema?: z.ZodType<V>
  toSettings?: (values: V) => Partial<AppSettings>
  invalid?: (values: V) => boolean
  children: (form: UseFormReturn<V>) => ReactNode
}) {
  const form = useForm<V>({
    defaultValues: defaultValues as DefaultValues<V>,
    resolver: schema ? (zodResolver(schema as never) as unknown as Resolver<V>) : undefined,
  })
  const save = useSaveSettingsMutation(company)
  const blocked = invalid?.(form.watch()) ?? false

  /** Saves the section, then resets the dirty state to what was saved. */
  function onSubmit(values: V) {
    if (blocked) return
    save.mutate(toSettings ? toSettings(values) : (values as Partial<AppSettings>), {
      onSuccess: () => { toast.success(`${title} saved`); form.reset(values) },
      onError: () => toast.error(`Failed to save ${title.toLowerCase()}`),
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-4">
      {description && <p className="text-xs text-ink-60">{description}</p>}
      {children(form)}
      <button
        type="submit"
        disabled={save.isPending || !form.formState.isDirty || blocked}
        className={`px-4 py-2 rounded-full text-sm font-medium text-white transition-colors ${THEME.buttonBg} ${THEME.buttonHoverBg} disabled:opacity-50`}
      >
        {save.isPending ? 'Saving…' : `Save ${title}`}
      </button>
    </form>
  )
}
