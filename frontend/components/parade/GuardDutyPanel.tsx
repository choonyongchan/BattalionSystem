'use client'

import { useState } from 'react'
import type { CompanyTheme } from '@/shared/companies'
import type { Exception } from '@/shared/types'
import { displayName } from '@/shared/names'
import { GUARD_DUTY_ROLES, DEFAULT_GUARD_DUTY_RANK_RULES } from '@/shared/ranks'
import type { AppSettings } from '@/backend/domain/settings/settings'
import { isInRange } from '@/backend/domain/duty/duty-rules'
import { isActiveOn } from '@/backend/domain/exceptions/active'
import { sortExceptions } from '@/backend/domain/parade/exception-table'
import { useConfirmDelete } from '@/frontend/hooks/useConfirmDelete'
import type { ParadeData } from '@/frontend/hooks/useParadeData'
import SearchDropdown from '@/frontend/components/shared/SearchDropdown'
import { CONFIRM_BTN, ICON_BTN, ICON_BTN_DANGER } from '@/frontend/components/shared/styles'
import { soldierDropdownProps } from './parade-ui'

/**
 * Guard Duty for the selected date. Unlike the roster duties, any number of people can be
 * assigned; entries are stored as 'Guard Duty' exceptions.
 */
export default function GuardDutyPanel({ theme, date, settings, data }: {
  theme: CompanyTheme
  date: string
  settings: AppSettings | undefined
  data: ParadeData
}) {
  const { soldiers, exceptions, repos, mutate, linkFields } = data
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', reason: '' })
  const [edit, setEdit] = useState<Exception | null>(null)
  const confirm = useConfirmDelete<number>()

  const entries = sortExceptions(exceptions).filter((e) => e.scope === 'Guard Duty' && isActiveOn(e, date))
  const inputClass = `w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 ${theme.focusRing}`
  const editInputClass = `w-full min-w-[6rem] border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 ${theme.focusRing}`

  /** Soldiers whose rank fits the role's rank range (settings override, else default). */
  function eligibleFor(role: string) {
    const rule = role ? (settings?.guard_duty_rank_overrides ?? {})[role] ?? DEFAULT_GUARD_DUTY_RANK_RULES[role] : undefined
    return rule ? soldiers.filter((s) => isInRange(rule, s.rank)) : soldiers
  }

  /** Keeps the picked soldier only if still eligible for the new role. */
  const withRole = <T extends { name: string; reason: string | null }>(row: T, reason: string): T =>
    ({ ...row, reason, name: eligibleFor(reason).some((s) => s.name === row.name) ? row.name : '' })

  /** Adds a guard duty entry for the selected date. */
  async function add() {
    if (!form.name) return
    const ok = await mutate(() => repos.exceptions.insert({
      name: form.name,
      scope: 'Guard Duty',
      reason: form.reason.trim() || null,
      start: date || null,
      end: date || null,
      counts_as_absence: false,
      ...linkFields(form.name, 'Guard Duty', null),
    }))
    if (ok) {
      setShowForm(false)
      setForm({ name: '', reason: '' })
    }
  }

  /** Saves the edited guard duty entry. */
  async function save() {
    if (!edit) return
    const ok = await mutate(() => repos.exceptions.update(edit.id, {
      name: edit.name,
      reason: edit.reason ?? null,
      start: edit.end || null,
      end: edit.end || null,
      ...linkFields(edit.name, 'Guard Duty', null),
    }))
    if (ok) setEdit(null)
  }

  const roleOptions = (
    <>
      <option value="">Select role</option>
      {GUARD_DUTY_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
    </>
  )

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <span className="text-sm font-medium text-gray-500">Guard Duty</span>
        <button
          onClick={() => {
            if (!showForm) setForm({ name: '', reason: '' })
            setShowForm((v) => !v)
          }}
          className={`px-3 py-1.5 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-xs font-medium rounded-lg transition-colors`}
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showForm && (
        <div className="p-4 space-y-3 border-b border-gray-100 bg-gray-50/50">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Role</label>
            <select value={form.reason} onChange={(e) => setForm(withRole(form, e.target.value))} className={inputClass}>
              {roleOptions}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Soldier <span className="text-red-500">*</span></label>
            <SearchDropdown
              {...soldierDropdownProps}
              items={eligibleFor(form.reason)}
              value={form.name}
              onChange={(name) => setForm({ ...form, name })}
              inputClass={inputClass}
              disabled={!form.reason}
            />
          </div>
          <button
            onClick={add}
            disabled={!form.name}
            className={`w-full py-2.5 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            Add Guard Duty
          </button>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No Guard Duty entries for this date.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-1.5 font-medium text-gray-500 whitespace-nowrap">Role</th>
                <th className="text-left px-3 py-1.5 font-medium text-gray-500 whitespace-nowrap">Name</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const isEditing = edit?.id === e.id
                return (
                  <tr key={e.id} className={`border-b border-gray-100 last:border-0 group ${i % 2 === 0 ? '' : 'bg-gray-50/50'} ${isEditing ? 'bg-blue-50/30' : ''}`}>
                    {isEditing && edit ? (
                      <>
                        <td className="px-2 py-1">
                          <select value={edit.reason ?? ''} onChange={(ev) => setEdit(withRole(edit, ev.target.value))} className={editInputClass}>
                            {roleOptions}
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <SearchDropdown
                            {...soldierDropdownProps}
                            items={eligibleFor(edit.reason ?? '')}
                            value={edit.name}
                            onChange={(name) => setEdit({ ...edit, name })}
                            inputClass={editInputClass}
                            disabled={!edit.reason}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <div className="flex gap-1 justify-end">
                            <button onClick={save} className={`px-2 py-1 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-xs rounded-lg`}>Save</button>
                            <button onClick={() => setEdit(null)} className="px-2 py-1 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50">Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-1.5 whitespace-nowrap text-gray-500">{e.reason ?? '–'}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap font-medium">{displayName(e.name, soldiers)}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <div className="flex gap-1 justify-end items-center">
                            <button onClick={() => setEdit({ ...e })} className={ICON_BTN} title="Edit">✎</button>
                            <button
                              onClick={() => confirm.isConfirming(e.id)
                                ? confirm.resolve(e.id, () => mutate(() => repos.exceptions.remove(e.id)))
                                : confirm.request(e.id)}
                              className={confirm.isConfirming(e.id) ? CONFIRM_BTN : ICON_BTN_DANGER}
                              title={confirm.isConfirming(e.id) ? 'Confirm clear' : 'Clear'}
                            >
                              {confirm.isConfirming(e.id) ? 'Yes' : '✕'}
                            </button>
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
      )}
    </div>
  )
}
