'use client'

import { useEffect, useState, type KeyboardEvent } from 'react'
import { SoldierRepository } from '@/backend/data/repositories/SoldierRepository'
import { OffLeaveRepository } from '@/backend/data/repositories/OffLeaveRepository'
import type { Soldier, OffLeave } from '@/shared/types'
import type { Company } from '@/shared/companies'
import { COMPANY_THEMES } from '@/shared/companies'
import { useConfirmDelete } from '@/frontend/hooks/useConfirmDelete'
import SearchDropdown from '@/frontend/components/shared/SearchDropdown'
import { isValidAmount, sortOffLeaveByRank } from '@/backend/domain/off-leave/off-leave'

type Kind = 'off' | 'leave'

const EMPTY_FORM = { name: '', kind: 'off' as Kind, amount: '' }

/**
 * True for a non-empty balance that is 0 or a valid amount.
 * Edited balances may be 0 (e.g. after deducting), unlike amounts being added.
 */
const isValidBalance = (v: string) => v !== '' && (Number(v) === 0 || isValidAmount(Number(v)))

/** Off/Leave tab: per-soldier off and leave balances with add, edit and delete. */
export default function OffLeaveTracking({ company }: { company: Company }) {
  const theme = COMPANY_THEMES[company]

  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [records, setRecords] = useState<OffLeave[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [editRow, setEditRow] = useState<{ name: string; off: string; leave: string } | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingName, setDeletingName] = useState<string | null>(null)
  const nameConfirm = useConfirmDelete<string>()

  useEffect(() => {
    setLoading(true)
    load()
  }, [company])

  const offLeaveRepo = new OffLeaveRepository(company)

  /**
   * Loads soldiers and balances; refreshes in place so edits keep the scroll position.
   * Refreshes in place so edits keep the scroll position
   */
  async function load() {
    setError(null)
    const [soldiersRes, recordsRes] = await Promise.all([
      new SoldierRepository(company).list(),
      offLeaveRepo.list(),
    ])
    const err = soldiersRes.error ?? recordsRes.error
    if (err) setError(err.message)
    setSoldiers(soldiersRes.data)
    setRecords(recordsRes.data)
    setLoading(false)
  }

  /** Adds the form's amount to the soldier's off or leave balance. */
  async function addRecord() {
    const amount = Number(form.amount)
    if (!form.name || !isValidAmount(amount)) return
    setSubmitting(true)
    const cur = records.find((r) => r.name === form.name) ?? { name: form.name, off: 0, leave: 0 }
    const { error } = await offLeaveRepo.upsert({ ...cur, [form.kind]: cur[form.kind] + amount })
    if (error) {
      setError(error.message)
    } else {
      setForm(EMPTY_FORM)
      setShowForm(false)
      await load()
    }
    setSubmitting(false)
  }

  const editValid = !!editRow && isValidBalance(editRow.off) && isValidBalance(editRow.leave)

  /** Saves the edited off and leave balances. */
  async function updateRecord() {
    if (!editRow || !editValid) return
    setSavingEdit(true)
    const { error } = await offLeaveRepo.update(editRow.name, Number(editRow.off), Number(editRow.leave))
    if (error) {
      setError(error.message)
    } else {
      setEditRow(null)
      await load()
    }
    setSavingEdit(false)
  }

  /** Deletes a soldier's balance row. */
  async function deleteRecord(name: string) {
    setDeletingName(name)
    const { error } = await offLeaveRepo.remove(name)
    if (error) setError(error.message)
    else await load()
    setDeletingName(null)
  }

  /** Enter saves, Escape cancels the inline edit. */
  function editKeys(e: KeyboardEvent) {
    if (e.key === 'Enter') updateRecord()
    if (e.key === 'Escape') setEditRow(null)
  }

  const soldierByName = new Map(soldiers.map((s) => [s.name, s]))
  const query = search.trim().toLowerCase()
  const filtered = query
    ? records.filter((r) => {
      const s = soldierByName.get(r.name)
      return [s?.rank, r.name, s?.four_d].some((v) => v?.toLowerCase().includes(query))
    })
    : records
  const rows = sortOffLeaveByRank(filtered, soldiers)

  const inputClass = `w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 ${theme.focusRing}`
  const editClass = `w-full min-w-[6rem] border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 ${theme.focusRing}`

  if (loading) return <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-gray-800">Off/Leave Tracking</h2>
        <p className="text-xs text-gray-500">{records.length} personnel</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <input
          type="search"
          placeholder="Search by rank, name, 4D..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
        />
        <div className="flex-shrink-0">
          <button
            onClick={() => {
              if (!showForm) setForm(EMPTY_FORM)
              setShowForm(!showForm)
            }}
            className={`px-4 py-3 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-sm font-medium rounded-xl transition-colors`}
          >
            {showForm ? 'Cancel' : '+ Off/Leave'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Soldier <span className="text-red-500">*</span></label>
            <SearchDropdown
              items={soldiers}
              value={form.name}
              getKey={(s) => s.name}
              getLabel={(s) => `${s.rank} ${s.name}`.trim()}
              matches={(s, q) => `${s.rank} ${s.name}`.toLowerCase().includes(q.toLowerCase())}
              renderOption={(s) => (
                <div className="flex gap-2">
                  <span className="font-mono text-xs text-gray-400 w-12 shrink-0 pt-0.5">{s.rank}</span>
                  <span className="font-medium text-gray-800">{s.name}</span>
                </div>
              )}
              onChange={(name) => setForm({ ...form, name })}
              inputClass={inputClass}
              placeholder="Search soldier..."
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-2">Type <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              {(['off', 'leave'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setForm({ ...form, kind: k })}
                  className={`flex-none px-3 py-2 rounded-xl text-sm font-medium border transition-colors whitespace-nowrap ${form.kind === k
                    ? `${theme.buttonBg} ${theme.buttonHoverBg} text-white border-transparent`
                    : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'}`}
                >
                  {k === 'off' ? 'Off' : 'Leave'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Number of days <span className="text-red-500">*</span></label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              placeholder="e.g. 1 or 0.5"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addRecord()}
              className={inputClass}
            />
          </div>

          <button
            onClick={addRecord}
            disabled={submitting || !form.name || !isValidAmount(Number(form.amount))}
            className={`w-full py-3 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {submitting ? 'Adding...' : 'Add Off/Leave'}
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {query ? 'No records match that query.' : 'No off/leave records.'}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 whitespace-nowrap">Rank</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 whitespace-nowrap">Name</th>
                  <th className="text-right px-3 py-1.5 font-medium text-gray-500 whitespace-nowrap">Off</th>
                  <th className="text-right px-3 py-1.5 font-medium text-gray-500 whitespace-nowrap">Leave</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isEditing = editRow?.name === r.name
                  return (
                    <tr
                      key={r.name}
                      className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/50'} ${isEditing ? 'bg-blue-50/30' : ''}`}
                    >
                      <td className="px-3 py-1.5 whitespace-nowrap font-mono text-xs text-gray-600">{soldierByName.get(r.name)?.rank ?? '–'}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap font-medium">{r.name}</td>
                      {isEditing ? (
                        <>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              aria-label="Off"
                              autoFocus
                              value={editRow.off}
                              onChange={(e) => setEditRow({ ...editRow, off: e.target.value })}
                              onKeyDown={editKeys}
                              className={editClass}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              aria-label="Leave"
                              value={editRow.leave}
                              onChange={(e) => setEditRow({ ...editRow, leave: e.target.value })}
                              onKeyDown={editKeys}
                              className={editClass}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={updateRecord}
                                disabled={savingEdit || !editValid}
                                className={`px-2 py-1 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-xs rounded-lg disabled:opacity-50`}
                              >
                                {savingEdit ? '…' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditRow(null)}
                                className="px-2 py-1 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-1.5 whitespace-nowrap text-right">{r.off}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-right">{r.leave}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <div className="flex gap-1 justify-end items-center">
                              <button
                                onClick={() => nameConfirm.isConfirming(r.name)
                                  ? nameConfirm.resolve(() => deleteRecord(r.name))
                                  : setEditRow({ name: r.name, off: String(r.off), leave: String(r.leave) })}
                                disabled={deletingName === r.name}
                                className={nameConfirm.isConfirming(r.name)
                                  ? 'px-2 py-1 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-sm'
                                  : 'text-gray-400 hover:text-gray-600 transition-colors text-base px-2 py-1 disabled:opacity-50'}
                                title={nameConfirm.isConfirming(r.name) ? 'Confirm delete' : 'Edit'}
                              >
                                {nameConfirm.isConfirming(r.name) ? 'Yes' : '✎'}
                              </button>
                              <button
                                onClick={() => nameConfirm.isConfirming(r.name) ? nameConfirm.cancel() : nameConfirm.request(r.name)}
                                disabled={deletingName === r.name}
                                className={nameConfirm.isConfirming(r.name)
                                  ? 'px-2 py-1 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-600 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50'
                                  : 'text-gray-400 hover:text-red-500 transition-colors text-base px-2 py-1 disabled:opacity-50'}
                                title={nameConfirm.isConfirming(r.name) ? 'Cancel' : 'Remove'}
                              >
                                {nameConfirm.isConfirming(r.name) ? 'No' : '✕'}
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
        </div>
      )}
    </div>
  )
}
