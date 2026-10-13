'use client'

import { useState, type KeyboardEvent } from 'react'
import { OffLeaveRepository } from '@/backend/data/repositories/OffLeaveRepository'
import type { Company } from '@/shared/companies'
import { combine, useOffLeave, useSoldiers, useWrite } from '@/frontend/hooks/queries'
import { useConfirmDelete } from '@/frontend/hooks/useConfirmDelete'
import SearchDropdown from '@/frontend/components/shared/SearchDropdown'
import { isValidAmount, sortOffLeaveByRank } from '@/backend/domain/off-leave/off-leave'
import { soldierDropdownProps } from '@/frontend/components/parade/parade-ui'
import { Button } from '@/frontend/components/ui/button'
import { Field, Input, SearchInput, inputClass } from '@/frontend/components/ui/fields'
import { Banner, Empty, Loading, PageHeader, Panel } from '@/frontend/components/ui/layout'
import { Segmented } from '@/frontend/components/ui/segmented'
import { EditActions, RowActions, TD, TD_EDIT, Table, Th, rowClass } from '@/frontend/components/ui/table'

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

  const editClass = inputClass({ compact: true })

  if (loading) return <Loading />

  return (
    <div className="space-y-3">
      <PageHeader title="Off/Leave Tracking" subtitle={`${records.length} personnel`} />

      <div className="flex items-center justify-between gap-4">
        <SearchInput
          placeholder="Search by rank, name, 4D..."
          aria-label="Search off/leave"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button
          variant={showForm ? 'secondary' : 'primary'}
          className="shrink-0"
          onClick={() => {
            if (!showForm) setForm(EMPTY_FORM)
            setShowForm(!showForm)
          }}
        >
          {showForm ? 'Cancel' : '+ Off/Leave'}
        </Button>
      </div>

      {error && <Banner>{error}</Banner>}

      {showForm && (
        <Panel>
          <Field label="Soldier" required>
            <SearchDropdown
              {...soldierDropdownProps}
              items={soldiers}
              value={form.name}
              onChange={(name) => setForm({ ...form, name })}
              inputClass={inputClass()}
            />
          </Field>

          <Segmented
            label={<>Type <span aria-hidden className="text-danger">*</span></>}
            value={form.kind}
            onChange={(kind) => setForm({ ...form, kind })}
            options={[{ value: 'off', label: 'Off' }, { value: 'leave', label: 'Leave' }]}
          />

          <Field label="Number of days" required>
            <Input
              type="number"
              step="0.5"
              min="0.5"
              placeholder="e.g. 1 or 0.5"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addRecord()}
            />
          </Field>

          <Button block onClick={addRecord} disabled={busy || !form.name || !isValidAmount(Number(form.amount))}>
            {busy ? 'Adding...' : 'Add Off/Leave'}
          </Button>
        </Panel>
      )}

      {rows.length === 0 ? (
        <Empty>{query ? 'No records match that query.' : 'No off/leave records.'}</Empty>
      ) : (
        <Table head={<>
          <Th>Rank</Th>
          <Th>Name</Th>
          <Th className="text-right">Off</Th>
          <Th className="text-right">Leave</Th>
          <th />
        </>}>
          {rows.map((r, i) => {
            const isEditing = editRow?.name === r.name
            return (
              <tr key={r.name} className={rowClass(i, isEditing)}>
                <td className={`${TD} font-mono text-xs text-ink-80`}>{soldierByName.get(r.name)?.rank ?? '–'}</td>
                <td className={`${TD} font-medium`}>{r.name}</td>
                {isEditing ? (
                  <>
                    <td className={TD_EDIT}>
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
                    <td className={TD_EDIT}>
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
                    <td className={TD_EDIT}>
                      <EditActions onSave={updateRecord} onCancel={() => setEditRow(null)} saving={busy} disabled={!editValid} />
                    </td>
                  </>
                ) : (
                  <>
                    <td className={`${TD} text-right`}>{r.off}</td>
                    <td className={`${TD} text-right`}>{r.leave}</td>
                    <td className={TD}>
                      <RowActions
                        confirming={nameConfirm.isConfirming(r.name)}
                        disabled={deletingName === r.name}
                        onEdit={() => setEditRow({ name: r.name, off: String(r.off), leave: String(r.leave) })}
                        onRequest={() => nameConfirm.request(r.name)}
                        onConfirm={() => nameConfirm.resolve(() => deleteRecord(r.name))}
                        onCancel={nameConfirm.cancel}
                      />
                    </td>
                  </>
                )}
              </tr>
            )
          })}
        </Table>
      )}
    </div>
  )
}
