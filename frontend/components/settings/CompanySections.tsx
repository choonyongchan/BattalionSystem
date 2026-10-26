'use client'

import { useState, type ReactNode } from 'react'
import { useFieldArray, type UseFormReturn } from 'react-hook-form'
import type { Company } from '@/shared/companies'
import { GUARD_DUTY } from '@/shared/guard-duty'
import { AppSettingsSchema, rosterDutyTypes, BASE_DUTY_TYPES, type AppSettings } from '@/backend/domain/settings/settings'
import { EXCEPTION_SCOPES } from '@/backend/domain/exceptions/exception-validation'
import { SCOPE_TYPES, isOnStrength } from '@/backend/domain/exceptions/active'
import { useSoldiers } from '@/frontend/hooks/queries'
import { Button } from '@/frontend/components/ui/button'
import { CheckField, Checkbox, Field, Input, Switch } from '@/frontend/components/ui/fields'
import { Chip } from '@/frontend/components/ui/layout'
import SettingsForm from './SettingsForm'

// Company structure and per-tab knobs: everything that used to be hardcoded per company.

type Props = { company: Company; settings: AppSettings }

/** Toggles `option` in or out of `list`. */
const toggle = (list: string[], option: string, on: boolean) => (on ? [...list, option] : list.filter((x) => x !== option))

/** Checkboxes picking a subset of `options`. */
function CheckList({ options, value, onChange }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {options.map((o) => (
        <CheckField key={o} label={o}>
          <Checkbox checked={value.includes(o)} onChange={(e) => onChange(toggle(value, o, e.target.checked))} />
        </CheckField>
      ))}
    </div>
  )
}

/** Removable chips plus a box to add more; Enter adds. */
function ChipInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('')
  /** Adds the draft unless blank or already listed. */
  const add = () => {
    const v = draft.trim()
    if (v && !value.includes(v)) onChange([...value, v])
    setDraft('')
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {value.map((v) => (
          <Chip key={v} removeLabel={`Remove ${v}`} onRemove={() => onChange(value.filter((x) => x !== v))}>{v}</Chip>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
        <Button type="button" variant="soft" onClick={add}>Add</Button>
      </div>
    </div>
  )
}

/** A labelled group of controls (checkboxes, chips) that a single <label> can't wrap. */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs text-ink-60">{label}</legend>
      {children}
    </fieldset>
  )
}

type PlatoonValues = Pick<AppSettings, 'platoons'>

const PlatoonsSchema = AppSettingsSchema.pick({ platoons: true }).refine(
  ({ platoons }) => new Set(platoons.map((p) => p.key)).size === platoons.length && platoons.every((p) => p.key !== 'HQ'),
  { message: 'Platoon keys must be unique and not HQ', path: ['platoons'] },
)

/** Settings: the platoon blocks under COY HQ. A key is what soldiers store, so it is fixed once saved. */
export function PlatoonsSection({ company, settings }: Props) {
  return (
    <SettingsForm<PlatoonValues>
      company={company}
      title="Platoons"
      description="Blocks under COY HQ in the parade state and conducts, in order. PDS1, PDS2, ... follow this order."
      schema={PlatoonsSchema}
      defaultValues={{ platoons: settings.platoons }}
    >
      {(form) => <PlatoonRows form={form} saved={settings.platoons.map((p) => p.key)} company={company} />}
    </SettingsForm>
  )
}

/** Editable platoon rows; a platoon with soldiers in it can't be removed. */
function PlatoonRows({ form, saved, company }: { form: UseFormReturn<PlatoonValues>; saved: string[]; company: Company }) {
  const { register, control, formState: { errors } } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'platoons' })
  const soldiers = (useSoldiers(company).data ?? []).filter(isOnStrength)
  const message = (errors.platoons as { message?: string } | undefined)?.message ?? errors.platoons?.root?.message
  return (
    <>
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs text-ink-60">
        <span>Key (on the roll)</span><span>Label</span><span>PDS label</span><span />
      </div>
      {fields.map((f, i) => {
        const count = soldiers.filter((s) => s.platoon === f.key).length
        return (
          <div key={f.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
            <Input aria-label="Platoon key" readOnly={saved.includes(f.key)} {...register(`platoons.${i}.key`)} />
            <Input aria-label="Platoon label" {...register(`platoons.${i}.label`)} />
            <Input aria-label="PDS label" {...register(`platoons.${i}.pdsLabel`)} />
            <Button
              type="button"
              variant="icon-danger"
              aria-label="Remove platoon"
              disabled={count > 0 || fields.length === 1}
              title={count > 0 ? `${count} soldier(s) still in this platoon` : 'Remove platoon'}
              onClick={() => remove(i)}
            >✕</Button>
          </div>
        )
      })}
      {message && <p role="alert" className="text-xs text-danger">{message}</p>}
      <Button type="button" variant="soft" onClick={() => append({ key: '', label: '', pdsLabel: '' })}>+ Add platoon</Button>
    </>
  )
}

/** Settings: extra rostered duties and which duties take two names. */
export function DutyRosterSection({ company, settings }: Props) {
  return (
    <SettingsForm<Pick<AppSettings, 'extra_duty_types' | 'multi_name_duty_types'>>
      company={company}
      title="Duty Roster"
      description={`Every company rosters ${BASE_DUTY_TYPES.join(', ')} and one PDS per platoon. Add any other duty here; set who may do it under Duty Eligibility.`}
      defaultValues={{ extra_duty_types: settings.extra_duty_types, multi_name_duty_types: settings.multi_name_duty_types }}
      invalid={(v) => v.extra_duty_types.some((d) => d === GUARD_DUTY || rosterDutyTypes({ ...settings, extra_duty_types: [] }).includes(d))}
    >
      {({ watch, setValue }) => {
        const v = watch()
        return (
          <>
            <Group label="Extra duties">
              <ChipInput value={v.extra_duty_types} placeholder="e.g. Duty Clerk" onChange={(x) => setValue('extra_duty_types', x, { shouldDirty: true })} />
            </Group>
            <Group label="Two names allowed (points split)">
              <CheckList
                options={rosterDutyTypes({ ...settings, extra_duty_types: v.extra_duty_types })}
                value={v.multi_name_duty_types}
                onChange={(x) => setValue('multi_name_duty_types', x, { shouldDirty: true })}
              />
            </Group>
          </>
        )
      }}
    </SettingsForm>
  )
}

/** Settings: the RSI message header, default RSI location and URTI keywords. */
export function ReportSickSection({ company, settings }: Props) {
  return (
    <SettingsForm<Pick<AppSettings, 'report_sick'>>
      company={company}
      title="Report Sick"
      schema={AppSettingsSchema.pick({ report_sick: true })}
      defaultValues={{ report_sick: settings.report_sick }}
    >
      {({ register, watch, setValue }) => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="RSI message company"><Input placeholder="e.g. HQ COY" {...register('report_sick.header_label')} /></Field>
            <Field label="Default RSI location"><Input placeholder="e.g. KHMC" {...register('report_sick.default_location')} /></Field>
          </div>
          <Group label="URTI keywords (pre-tick URTI when the reason has one)">
            <ChipInput
              value={watch('report_sick.urti_keywords')}
              placeholder="e.g. sore throat"
              onChange={(x) => setValue('report_sick.urti_keywords', x, { shouldDirty: true })}
            />
          </Group>
        </>
      )}
    </SettingsForm>
  )
}

/** Settings: whether COY HQ joins conducts, and which statuses wait for a commander's call. */
export function ConductsSection({ company, settings }: Props) {
  return (
    <SettingsForm<Pick<AppSettings, 'conducts'>>
      company={company}
      title="Conducts"
      description="Conducts count troopers only."
      defaultValues={{ conducts: settings.conducts }}
    >
      {({ watch, setValue }) => (
        <>
          <label className="flex min-h-11 items-center justify-between text-sm text-ink-80">
            COY HQ takes part
            <Switch checked={watch('conducts.include_hq')} onChange={(e) => setValue('conducts.include_hq', e.target.checked, { shouldDirty: true })} />
          </label>
          <Group label="Needs a commander's call (out until decided)">
            <CheckList
              options={SCOPE_TYPES.Status}
              value={watch('conducts.needs_call_types')}
              onChange={(x) => setValue('conducts.needs_call_types', x, { shouldDirty: true })}
            />
          </Group>
        </>
      )}
    </SettingsForm>
  )
}

/** Settings: which scopes end their parade-state lines with IN or OUT (OUT when counted absent). */
export function InOutSection({ company, settings }: Props) {
  return (
    <SettingsForm<Pick<AppSettings, 'in_out_scopes'>>
      company={company}
      title="IN/OUT"
      description="Lines in these scopes end OUT when Absent is ticked, else IN."
      defaultValues={{ in_out_scopes: settings.in_out_scopes }}
    >
      {({ watch, setValue }) => (
        <Group label="Print IN/OUT in parade state">
          <CheckList
            options={EXCEPTION_SCOPES}
            value={watch('in_out_scopes')}
            onChange={(x) => setValue('in_out_scopes', x, { shouldDirty: true })}
          />
        </Group>
      )}
    </SettingsForm>
  )
}

/** Settings: the Overview tab's bunk strength message and what keeps a trooper out of the bunk. */
export function OverviewSection({ company, settings }: Props) {
  return (
    <SettingsForm<Pick<AppSettings, 'overview'>>
      company={company}
      title="Overview"
      schema={AppSettingsSchema.pick({ overview: true })}
      defaultValues={{ overview: settings.overview }}
    >
      {({ register, watch, setValue }) => (
        <>
          <Field label="Message title"><Input placeholder="e.g. CURRENT STRENGTH CAA" {...register('overview.message_title')} /></Field>
          <Group label="Out of the bunk (besides anything counted absent)">
            <CheckList
              options={EXCEPTION_SCOPES}
              value={watch('overview.out_scopes')}
              onChange={(x) => setValue('overview.out_scopes', x, { shouldDirty: true })}
            />
          </Group>
        </>
      )}
    </SettingsForm>
  )
}
