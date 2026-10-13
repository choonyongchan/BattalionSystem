'use client'

import { useState } from 'react'
import type { DutyEntry, Soldier } from '@/shared/types'
import { DUTY_NAME_SEP, EXTERNAL_DUTY_PERSON, displayName, splitDutyNames } from '@/shared/names'
import { dayHeaderLabel, offsetDate, todaySGDate, weekDates } from '@/shared/dates'
import { rosterDutyTypes, type AppSettings } from '@/backend/domain/settings/settings'
import { eligibleSoldiers } from '@/backend/domain/duty/duty-rules'
import { useConfirmDelete } from '@/frontend/hooks/useConfirmDelete'
import type { ParadeData } from '@/frontend/hooks/useParadeData'
import SearchDropdown from '@/frontend/components/shared/SearchDropdown'
import { Button } from '@/frontend/components/ui/button'
import { inputClass } from '@/frontend/components/ui/fields'
import { EditActions, RowActions, TD, TD_EDIT, Table, Th, rowClass } from '@/frontend/components/ui/table'
import { cn } from '@/shared/utils'
import { soldierDropdownProps } from './parade-ui'
import GuardDutyPanel from './GuardDutyPanel'

const EXTERNAL_PERSONNEL: Soldier = { rank: '', name: EXTERNAL_DUTY_PERSON, platoon: '', four_d: '' }

type EditDuty = { duty_type: string; name: string; name2: string }

/** Week picker, the day's duty roster (inline edit) and Guard Duty. */
export default function DutiesSection({ date, setDate, settings, data }: {
  date: string
  setDate: (iso: string) => void
  settings: AppSettings | undefined
  data: ParadeData
}) {
  const { soldiers, duties, repos, mutate } = data
  const [editDuty, setEditDuty] = useState<EditDuty | null>(null)
  const [saving, setSaving] = useState(false)
  const confirm = useConfirmDelete<string>()

  const dutyTypes = settings ? rosterDutyTypes(settings) : []
  const editInputClass = inputClass({ compact: true })

  /** Soldiers eligible for a duty; Duty Clerk may also take an external partner. */
  function personnelFor(dutyType: string, excludeExternal: boolean) {
    const items = eligibleSoldiers(dutyType, soldiers, settings?.eligibility_name_overrides ?? {}, settings?.eligibility_rank_overrides ?? {})
    return dutyType !== 'Duty Clerk' || excludeExternal ? items : [...items, EXTERNAL_PERSONNEL]
  }

  /** Saves the edited duty; two names are joined with DUTY_NAME_SEP. */
  async function saveDuty() {
    if (!editDuty) return
    setSaving(true)
    const name = [editDuty.name, editDuty.name2].filter((n) => n.trim() !== '').join(DUTY_NAME_SEP).toUpperCase()
    if (await mutate(() => repos.duties.upsert({ duty_type: editDuty.duty_type, date, name }))) setEditDuty(null)
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <WeekStrip date={date} setDate={setDate} duties={duties} dutyTypes={dutyTypes} soldiers={soldiers} />

      <Table head={<><Th>Duty</Th><Th>Assigned To</Th><th /></>}>
        {dutyTypes.map((dt, i) => {
          const d = duties.find((x) => x.duty_type === dt && x.date === date)
          const isEditing = editDuty?.duty_type === dt
          return (
            <tr key={dt} className={rowClass(i, isEditing)}>
              <td className={`${TD} font-medium`}>{dt}</td>
              {isEditing ? (
                <>
                  <td className={`${TD_EDIT} space-y-1`}>
                    <SearchDropdown
                      {...soldierDropdownProps}
                      items={personnelFor(editDuty.duty_type, editDuty.name2 === EXTERNAL_DUTY_PERSON)}
                      value={editDuty.name}
                      onChange={(name) => setEditDuty({ ...editDuty, name })}
                      inputClass={editInputClass}
                    />
                    {settings?.multi_name_duty_types.includes(editDuty.duty_type) && editDuty.name.trim() !== '' && (
                      <SearchDropdown
                        {...soldierDropdownProps}
                        items={personnelFor(editDuty.duty_type, editDuty.name === EXTERNAL_DUTY_PERSON)}
                        value={editDuty.name2}
                        onChange={(name) => setEditDuty({ ...editDuty, name2: name })}
                        inputClass={editInputClass}
                        placeholder="Second Duty Personnel?"
                      />
                    )}
                  </td>
                  <td className={TD_EDIT}>
                    <EditActions onSave={saveDuty} onCancel={() => setEditDuty(null)} saving={saving} />
                  </td>
                </>
              ) : (
                <>
                  <td className={`${TD} text-ink-80`}>{d?.name ? displayName(d.name, soldiers) : '–'}</td>
                  <td className={TD}>
                    <RowActions
                      confirming={confirm.isConfirming(dt)}
                      editLabel={`Edit ${dt}`}
                      onEdit={() => {
                        const [n1, n2] = splitDutyNames(d?.name ?? '')
                        setEditDuty({ duty_type: dt, name: n1 ?? '', name2: n2 ?? '' })
                      }}
                      onRequest={d ? () => confirm.request(dt) : undefined}
                      onConfirm={() => confirm.resolve(() => mutate(() => repos.duties.remove(dt, date)))}
                      onCancel={confirm.cancel}
                      removeTitle="Clear"
                      confirmTitle="Confirm clear"
                    />
                  </td>
                </>
              )}
            </tr>
          )
        })}
      </Table>

      <GuardDutyPanel date={date} settings={settings} data={data} />
    </div>
  )
}

/** Mon–Sun strip of day cards showing each day's duties; clicking a card selects that date. */
function WeekStrip({ date, setDate, duties, dutyTypes, soldiers }: {
  date: string
  setDate: (iso: string) => void
  duties: DutyEntry[]
  dutyTypes: string[]
  soldiers: Soldier[]
}) {
  const today = todaySGDate()
  return (
    // Phones: controls on one row, the week as a full-width row under them; md+: one row
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button variant="secondary" size="sm" onClick={() => setDate(today)}>Today</Button>
      <Button variant="icon" onClick={() => setDate(offsetDate(date, -7))} aria-label="Previous week">←</Button>

      <div className="order-last grid basis-full grid-cols-7 gap-1 sm:gap-2 md:order-none md:basis-auto md:flex-1">
        {weekDates(date).map((iso) => {
          const label = dayHeaderLabel(iso)
          const isSelected = iso === date
          const dayDuties = dutyTypes
            .map((dt) => ({ dt, entry: duties.find((x) => x.duty_type === dt && x.date === iso) }))
            .filter((x) => x.entry)
          return (
            <button
              key={iso}
              onClick={() => setDate(iso)}
              aria-pressed={isSelected}
              className={cn('min-h-14 rounded-lg border p-1.5 text-left transition-colors sm:p-2', isSelected ? 'border-transparent bg-action text-white' : iso === today ? 'border-hairline bg-parchment' : 'border-hairline bg-white hover:bg-parchment')}
            >
              <div className={`text-[10px] sm:text-xs font-medium ${isSelected ? 'text-white/80' : 'text-ink-60'}`}>{label.weekday}</div>
              <div className={`text-xs sm:text-sm font-semibold mb-1 ${isSelected ? 'text-white' : 'text-ink-80'}`}>{label.day}</div>
              {/* Phones show a dot for a day with duties; the names need a wider cell */}
              {dayDuties.length > 0 && <span aria-hidden className={`block size-1.5 rounded-full sm:hidden ${isSelected ? 'bg-white' : 'bg-ink-60'}`} />}
              <div className="hidden space-y-0.5 sm:block">
                {dayDuties.map(({ dt, entry }) => (
                  <div key={dt} className={`text-[9px] sm:text-[11px] leading-tight truncate ${isSelected ? 'text-white/90' : 'text-ink-60'}`}>
                    <span className="font-medium">{dt}</span> {displayName(entry!.name, soldiers)}
                  </div>
                ))}
                {dayDuties.length === 0 && (
                  <div className={`text-[9px] sm:text-[11px] ${isSelected ? 'text-white/50' : 'text-ink-48'}`}>–</div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <Button variant="icon" onClick={() => setDate(offsetDate(date, 7))} aria-label="Next week">→</Button>
      <input
        type="date"
        value={date}
        aria-label="Duty date"
        onChange={(e) => setDate(e.target.value)}
        className={cn(inputClass(), 'w-auto min-w-0 flex-1 md:flex-none')}
      />
    </div>
  )
}
