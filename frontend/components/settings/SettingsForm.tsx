'use client'

import type { ReactNode } from 'react'
import { useForm, type DefaultValues, type FieldValues, type Resolver, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import type { Company } from '@/shared/companies'
import type { AppSettings } from '@/backend/domain/settings/settings'
import { useSaveSettingsMutation } from '@/frontend/hooks/queries'
import { Button } from '@/frontend/components/ui/button'
import { Banner } from '@/frontend/components/ui/layout'

/**
 * One settings section: owns the form, the save, its result message and the Save button,
 * so a section only renders its fields.
 * @param title Names the section in the button and messages, e.g. "Parade Times".
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
      onSuccess: () => form.reset(values),
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-4">
      {description && <p className="text-xs text-ink-60">{description}</p>}
      {children(form)}
      {save.isError && <Banner>Failed to save {title.toLowerCase()}</Banner>}
      {/* Clears on the next edit, which dirties the form again */}
      {save.isSuccess && !form.formState.isDirty && <Banner tone="success">{title} saved</Banner>}
      <Button type="submit" disabled={save.isPending || !form.formState.isDirty || blocked}>
        {save.isPending ? 'Saving…' : `Save ${title}`}
      </Button>
    </form>
  )
}
