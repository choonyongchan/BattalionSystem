'use client'

import { useState, type KeyboardEvent } from 'react'
import { OffLeaveRepository } from '@/backend/data/repositories/OffLeaveRepository'
import type { Company } from '@/shared/companies'
import { combine, useOffLeave, useSoldiers, useWrite } from '@/frontend/hooks/queries'
import { useConfirmDelete } from '@/frontend/hooks/useConfirmDelete'
import SearchDropdown from '@/frontend/components/shared/SearchDropdown'
import { isValidAmount, sortOffLeaveByRank } from '@/backend/domain/off-leave/off-leave'
import { THEME } from '@/frontend/theme'

type Kind = 'off' | 'leave'

const EMPTY_FORM = { name: '', kind: 'off' as Kind, amount: '' }

/**
 * True for a non-empty balance that is 0 or a valid amount.
 * Edited balances may be 0 (e.g. after deducting), unlike amounts being added.
 */
const isValidBalance = (v: string) => v !== '' && (Number(v) === 0 || isValidAmount(Number(v)))

/** Off/Leave tab: per-soldier off and leave balances with add, edit and delete. */
export default function OffLeaveTracking({ company }: { company: Company }) {

  const soldiersQ = useSoldiers(company)
  const recordsQ = useOffLeave(company)
  const { run, busy, error: writeError } = useWrite(company)
  const { loading, error: loadError } = combine(soldiersQ, recordsQ)
  const error = writeError ?? loadError
  const soldiers = soldiersQ.data ?? []
  const records = recordsQ.data ?? []
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editRow, setEditRow] = useState<{ name: string; off: string; leave: string } | null>(null)
  const [deletingName, setDeletingName] = useState<string | null>(null)
  const nameConfirm = useConfirmDelete<string>()
  const offLeaveRepo = new OffLeaveRepository(company)
  /** Adds the form's amount to the soldier's off or leave balance. */
  async function addRecord() {
    const amount = Number(form.amount)
    if (!form.name || !isValidAmount(amount)) return
    const cur = records.find((r) => r.name === form.name) ?? { name: form.name, off: 0, leave: 0 }
    if (await run(() => offLeaveRepo.upsert({ ...cur, [form.kind]: cur[form.kind] + amount }))) {
      setForm(EMPTY_FORM)
      setShowForm(false)
    }
  }

  const editValid = !!editRow && isValidBalance(editRow.off) && isValidBalance(editRow.leave)

  /** Saves the edited off and leave balances. */
  async function updateRecord() {
    if (!editRow || !editValid) return
    if (await run(() => offLeaveRepo.update(editRow.name, Number(editRow.off), Number(editRow.leave)))) setEditRow(null)
  }

  /** Deletes a soldier's balance row. */
  async function deleteRecord(name: string) {
    setDeletingName(name)
    await run(() => offLeaveRepo.remove(name))
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

  const inputClass = `w-full border border-hairline rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 ${THEME.focusRing}`
  const editClass = `w-full min-w-[6rem] border border-hairline rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 ${THEME.focusRing}`

  if (loading) return <div className="text-ink-60 text-sm py-8 text-center">Loading...</div>

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-ink">Off/Leave Tracking</h2>
        <p className="text-xs text-ink-60">{records.length} personnel</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <input
          type="search"
          placeholder="Search by rank, name, 4D..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-hairline rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-action-focus bg-white"
        />
        <div className="flex-shrink-0">
          <button
            onClick={() => {
              if (!showForm) setForm(EMPTY_FORM)
              setShowForm(!showForm)
            }}
            className={`px-4 py-3 ${THEME.buttonBg} ${THEME.buttonHoverBg} text-white text-sm font-medium rounded-lg transition-colors`}
          >
            {showForm ? 'Cancel' : '+ Off/Leave'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-danger/5 border border-danger/30 text-danger px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-parchment border border-hairline rounded-card p-4 space-y-4">
          <div>
            <label className="block text-xs text-ink-60 mb-1">Soldier <span className="text-danger">*</span></label>
            <SearchDropdown
              items={soldiers}
              value={form.name}
              getKey={(s) => s.name}
              getLabel={(s) => `${s.rank} ${s.name}`.trim()}
              matches={(s, q) => `${s.rank} ${s.name}`.toLowerCase().includes(q.toLowerCase())}
              renderOption={(s) => (
                <div className="flex gap-2">
                  <span className="font-mono text-xs text-ink-60 w-12 shrink-0 pt-0.5">{s.rank}</span>
                  <span className="font-medium text-ink">{s.name}</span>
                </div>
              )}
              onChange={(name) => setForm({ ...form, name })}
              inputClass={inputClass}
              placeholder="Search soldier..."
            />
          </div>

          <div>
            <label className="block text-xs text-ink-60 mb-2">Type <span className="text-danger">*</span></label>
            <div className="flex gap-2">
              {(['off', 'leave'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setForm({ ...form, kind: k })}
                  className={`flex-none px-3 py-2 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap ${form.kind === k
                    ? `${THEME.buttonBg} ${THEME.buttonHoverBg} text-white border-transparent`
                    : 'bg-white border-hairline text-ink-80 hover:border-hairline'}`}
                >
                  {k === 'off' ? 'Off' : 'Leave'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-ink-60 mb-1">Number of days <span className="text-danger">*</span></label>
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
            disabled={busy || !form.name || !isValidAmount(Number(form.amount))}
            className={`w-full py-3 ${THEME.buttonBg} ${THEME.buttonHoverBg} text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {busy ? 'Adding...' : 'Add Off/Leave'}
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-center py-12 text-ink-60 text-sm">
          {query ? 'No records match that query.' : 'No off/leave records.'}
        </div>
      ) : (
        <div className="bg-white border border-hairline rounded-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-parchment border-b border-hairline">
                  <th className="text-left px-3 py-1.5 font-medium text-ink-60 whitespace-nowrap">Rank</th>
                  <th className="text-left px-3 py-1.5 font-medium text-ink-60 whitespace-nowrap">Name</th>
                  <th className="text-right px-3 py-1.5 font-medium text-ink-60 whitespace-nowrap">Off</th>
                  <th className="text-right px-3 py-1.5 font-medium text-ink-60 whitespace-nowrap">Leave</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isEditing = editRow?.name === r.name
                  return (
                    <tr
                      key={r.name}
                      className={`border-b border-hairline last:border-0 ${i % 2 === 0 ? '' : 'bg-parchment/50'} ${isEditing ? 'bg-action/5' : ''}`}
                    >
                      <td className="px-3 py-1.5 whitespace-nowrap font-mono text-xs text-ink-80">{soldierByName.get(r.name)?.rank ?? '–'}</td>
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
                                disabled={busy || !editValid}
                                className={`px-2 py-1 ${THEME.buttonBg} ${THEME.buttonHoverBg} text-white text-xs rounded-lg disabled:opacity-50`}
                              >
                                {busy ? '…' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditRow(null)}
                                className="px-2 py-1 border border-hairline text-ink-80 text-xs rounded-lg hover:bg-parchment"
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
                                  ? 'px-2 py-1 bg-danger hover:bg-danger active:bg-danger text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50'
                                  : 'text-ink-60 hover:text-ink-80 transition-colors text-base px-2 py-1 disabled:opacity-50'}
                                title={nameConfirm.isConfirming(r.name) ? 'Confirm delete' : 'Edit'}
                              >
                                {nameConfirm.isConfirming(r.name) ? 'Yes' : '✎'}
                              </button>
                              <button
                                onClick={() => nameConfirm.isConfirming(r.name) ? nameConfirm.cancel() : nameConfirm.request(r.name)}
                                disabled={deletingName === r.name}
                                className={nameConfirm.isConfirming(r.name)
                                  ? 'px-2 py-1 bg-parchment hover:bg-hairline active:bg-hairline text-ink-80 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50'
                                  : 'text-ink-60 hover:text-danger transition-colors text-base px-2 py-1 disabled:opacity-50'}
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
