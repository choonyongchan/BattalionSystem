'use client'

import { useState } from 'react'
import type { Company, CompanyTheme } from '@/shared/companies'
import { ALL_DUTY_TYPES, MULTI_NAME_DUTY_TYPES } from '@/shared/companies'
import type { DutyEntry, Soldier } from '@/shared/types'
import { DUTY_NAME_SEP, EXTERNAL_DUTY_PERSON, displayName, splitDutyNames } from '@/shared/names'
import { dayHeaderLabel, offsetDate, todaySGDate, weekDates } from '@/shared/dates'
import type { AppSettings } from '@/backend/domain/settings/settings'
import { eligibleSoldiers } from '@/backend/domain/duty/duty-rules'
import { useConfirmDelete } from '@/frontend/hooks/useConfirmDelete'
import type { ParadeData } from '@/frontend/hooks/useParadeData'
import SearchDropdown from '@/frontend/components/shared/SearchDropdown'
import { CONFIRM_BTN, ICON_BTN, ICON_BTN_DANGER } from '@/frontend/components/shared/styles'
import { soldierDropdownProps } from './parade-ui'
import GuardDutyPanel from './GuardDutyPanel'

const EXTERNAL_PERSONNEL: Soldier = { rank: '', name: EXTERNAL_DUTY_PERSON, platoon: '', four_d: '' }

type EditDuty = { duty_type: string; name: string; name2: string }

/** Week picker, the day's duty roster (inline edit) and Guard Duty. */
export default function DutiesSection({ company, theme, date, setDate, settings, data }: {
  company: Company
  theme: CompanyTheme
  date: string
  setDate: (iso: string) => void
  settings: AppSettings | undefined
  data: ParadeData
}) {
  const { soldiers, duties, repos, mutate } = data
  const [editDuty, setEditDuty] = useState<EditDuty | null>(null)
  const [saving, setSaving] = useState(false)
  const confirm = useConfirmDelete<string>()

  const dutyTypes = company === 'hercules' ? [...ALL_DUTY_TYPES, 'Duty Clerk'] : ALL_DUTY_TYPES
  const editInputClass = `w-full min-w-[6rem] border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 ${theme.focusRing}`

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
      <WeekStrip theme={theme} date={date} setDate={setDate} duties={duties} dutyTypes={dutyTypes} soldiers={soldiers} />

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-1.5 font-medium text-gray-500 whitespace-nowrap">Duty</th>
                <th className="text-left px-3 py-1.5 font-medium text-gray-500 whitespace-nowrap">Assigned To</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dutyTypes.map((dt, i) => {
                const d = duties.find((x) => x.duty_type === dt && x.date === date)
                const isEditing = editDuty?.duty_type === dt
                return (
                  <tr key={dt} className={`border-b border-gray-100 last:border-0 group ${i % 2 === 0 ? '' : 'bg-gray-50/50'} ${isEditing ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-3 py-1.5 whitespace-nowrap font-medium">{dt}</td>
                    {isEditing ? (
                      <>
                        <td className="px-2 py-1 space-y-1">
                          <SearchDropdown
                            {...soldierDropdownProps}
                            items={personnelFor(editDuty.duty_type, editDuty.name2 === EXTERNAL_DUTY_PERSON)}
                            value={editDuty.name}
                            onChange={(name) => setEditDuty({ ...editDuty, name })}
                            inputClass={editInputClass}
                          />
                          {MULTI_NAME_DUTY_TYPES.includes(editDuty.duty_type) && editDuty.name.trim() !== '' && (
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
                        <td className="px-2 py-1">
                          <div className="flex gap-1 justify-end">
                            <button onClick={saveDuty} disabled={saving} className={`px-2 py-1 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-xs rounded-lg disabled:opacity-50`}>
                              {saving ? '…' : 'Save'}
                            </button>
                            <button onClick={() => setEditDuty(null)} className="px-2 py-1 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50">
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">{d?.name ? displayName(d.name, soldiers) : '–'}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <div className="flex gap-1 justify-end items-center">
                            <button
                              onClick={() => {
                                const [n1, n2] = splitDutyNames(d?.name ?? '')
                                setEditDuty({ duty_type: dt, name: n1 ?? '', name2: n2 ?? '' })
                              }}
                              className={ICON_BTN}
                              title="Edit"
                              aria-label={`Edit ${dt}`}
                            >
                              ✎
                            </button>
                            {d && (
                              <button
                                onClick={() => confirm.isConfirming(dt)
                                  ? confirm.resolve(dt, () => mutate(() => repos.duties.remove(dt, date)))
                                  : confirm.request(dt)}
                                className={confirm.isConfirming(dt) ? CONFIRM_BTN : ICON_BTN_DANGER}
                                title={confirm.isConfirming(dt) ? 'Confirm clear' : 'Clear'}
                              >
                                {confirm.isConfirming(dt) ? 'Yes' : '✕'}
                              </button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <GuardDutyPanel theme={theme} date={date} settings={settings} data={data} />
    </div>
  )
}

/** Mon–Sun strip of day cards showing each day's duties; clicking a card selects that date. */
function WeekStrip({ theme, date, setDate, duties, dutyTypes, soldiers }: {
  theme: CompanyTheme
  date: string
  setDate: (iso: string) => void
  duties: DutyEntry[]
  dutyTypes: string[]
  soldiers: Soldier[]
}) {
  const today = todaySGDate()
  return (
    <div className="flex items-center justify-center gap-2">
      <button onClick={() => setDate(today)} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-800 border border-gray-300 rounded-xl transition-colors">
        Today
      </button>
      <button onClick={() => setDate(offsetDate(date, -7))} aria-label="Previous week" className="px-3 py-2 text-gray-500 hover:text-gray-800 text-lg transition-colors">←</button>

      <div className="grid grid-cols-7 gap-1 sm:gap-2 flex-1">
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
              className={`text-left rounded-xl border p-1.5 sm:p-2 transition-colors ${isSelected ? `${theme.buttonBg} border-transparent text-white` : iso === today ? 'bg-gray-50 border-gray-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
            >
              <div className={`text-[10px] sm:text-xs font-medium ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>{label.weekday}</div>
              <div className={`text-xs sm:text-sm font-semibold mb-1 ${isSelected ? 'text-white' : 'text-gray-700'}`}>{label.day}</div>
              <div className="space-y-0.5">
                {dayDuties.map(({ dt, entry }) => (
                  <div key={dt} className={`text-[9px] sm:text-[11px] leading-tight truncate ${isSelected ? 'text-white/90' : 'text-gray-500'}`}>
                    <span className="font-medium">{dt}</span> {displayName(entry!.name, soldiers)}
                  </div>
                ))}
                {dayDuties.length === 0 && (
                  <div className={`text-[9px] sm:text-[11px] ${isSelected ? 'text-white/50' : 'text-gray-300'}`}>–</div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <button onClick={() => setDate(offsetDate(date, 7))} aria-label="Next week" className="px-3 py-2 text-gray-500 hover:text-gray-800 text-lg transition-colors">→</button>
      <input
        type="date"
        value={date}
        aria-label="Duty date"
        onChange={(e) => setDate(e.target.value)}
        className={`border border-gray-300 rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 ${theme.focusRing}`}
      />
    </div>
  )
}
