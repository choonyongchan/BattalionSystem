'use client'

import { useState } from 'react'
import { useFieldArray, type UseFormReturn } from 'react-hook-form'
import type { Company } from '@/shared/companies'
import { AppSettingsSchema, rosterDutyTypes, BASE_DUTY_TYPES, type AppSettings } from '@/backend/domain/settings/settings'
import { EXCEPTION_SCOPES } from '@/backend/domain/exceptions/exception-validation'
import { SCOPE_TYPES, isOnStrength } from '@/backend/domain/exceptions/active'
import { PARADE_TYPES } from '@/frontend/components/parade/parade-ui'
import { useSoldiers } from '@/frontend/hooks/queries'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'
import { Switch } from '@/frontend/components/ui/switch'
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
        <label key={o} className="flex items-center gap-2 text-sm text-ink-80">
          <input type="checkbox" className="h-4 w-4" checked={value.includes(o)} onChange={(e) => onChange(toggle(value, o, e.target.checked))} />
          {o}
        </label>
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
          <span key={v} className="inline-flex items-center gap-1 bg-parchment text-ink-80 text-xs px-2 py-1 rounded-lg">
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="text-ink-60 hover:text-danger">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
        <button type="button" onClick={add} className="bg-parchment text-ink-80 hover:bg-hairline rounded-full px-3 py-1.5 text-sm font-medium">Add</button>
      </div>
    </div>
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
            <button
              type="button"
              disabled={count > 0 || fields.length === 1}
              title={count > 0 ? `${count} soldier(s) still in this platoon` : undefined}
              onClick={() => remove(i)}
              className="text-ink-60 hover:text-danger disabled:opacity-30"
            >×</button>
          </div>
        )
      })}
      {message && <p className="text-xs text-danger">{message}</p>}
      <button
        type="button"
        onClick={() => append({ key: '', label: '', pdsLabel: '' })}
        className="bg-parchment text-ink-80 hover:bg-hairline rounded-full px-3 py-1.5 text-sm font-medium"
      >+ Add platoon</button>
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
      invalid={(v) => v.extra_duty_types.some((d) => d === 'Guard Duty' || rosterDutyTypes({ ...settings, extra_duty_types: [] }).includes(d))}
    >
      {({ watch, setValue }) => {
        const v = watch()
        return (
          <>
            <div>
              <Label className="text-xs text-ink-60 mb-2 block">Extra duties</Label>
              <ChipInput value={v.extra_duty_types} placeholder="e.g. Duty Clerk" onChange={(x) => setValue('extra_duty_types', x, { shouldDirty: true })} />
            </div>
            <div>
              <Label className="text-xs text-ink-60 mb-2 block">Two names allowed (points split)</Label>
              <CheckList
                options={rosterDutyTypes({ ...settings, extra_duty_types: v.extra_duty_types })}
                value={v.multi_name_duty_types}
                onChange={(x) => setValue('multi_name_duty_types', x, { shouldDirty: true })}
              />
            </div>
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
            <div>
              <Label className="text-xs text-ink-60 mb-1 block">RSI message company</Label>
              <Input placeholder="e.g. HQ COY" {...register('report_sick.header_label')} />
            </div>
            <div>
              <Label className="text-xs text-ink-60 mb-1 block">Default RSI location</Label>
              <Input placeholder="e.g. KHMC" {...register('report_sick.default_location')} />
            </div>
          </div>
          <div>
            <Label className="text-xs text-ink-60 mb-2 block">URTI keywords (pre-tick URTI when the reason has one)</Label>
            <ChipInput
              value={watch('report_sick.urti_keywords')}
              placeholder="e.g. sore throat"
              onChange={(x) => setValue('report_sick.urti_keywords', x, { shouldDirty: true })}
            />
          </div>
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
          <div className="flex items-center justify-between py-1">
            <Label className="text-sm text-ink-80">COY HQ takes part</Label>
            <Switch checked={watch('conducts.include_hq')} onCheckedChange={(v) => setValue('conducts.include_hq', v, { shouldDirty: true })} />
          </div>
          <div>
            <Label className="text-xs text-ink-60 mb-2 block">Needs a commander&apos;s call (out until decided)</Label>
            <CheckList
              options={SCOPE_TYPES.Status}
              value={watch('conducts.needs_call_types')}
              onChange={(x) => setValue('conducts.needs_call_types', x, { shouldDirty: true })}
            />
          </div>
        </>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-ink-60 mb-1 block">Message title</Label>
              <Input placeholder="e.g. STRENGTH CAA" {...register('overview.message_title')} />
            </div>
            <div>
              <Label className="text-xs text-ink-60 mb-1 block">Default parade</Label>
              <select className="w-full border border-hairline rounded-lg px-3 py-2 text-sm bg-white" {...register('overview.default_parade')}>
                {PARADE_TYPES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs text-ink-60 mb-2 block">Out of the bunk (besides anything counted absent)</Label>
            <CheckList
              options={EXCEPTION_SCOPES}
              value={watch('overview.out_scopes')}
              onChange={(x) => setValue('overview.out_scopes', x, { shouldDirty: true })}
            />
          </div>
        </>
      )}
    </SettingsForm>
  )
}
