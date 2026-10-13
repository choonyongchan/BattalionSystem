'use client'

import { useState } from 'react'
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
import { Button } from '@/frontend/components/ui/button'
import { Field, Select, inputClass } from '@/frontend/components/ui/fields'
import { Card, Empty } from '@/frontend/components/ui/layout'
import { EditActions, RowActions, TD, TD_EDIT, Table, Th, rowClass } from '@/frontend/components/ui/table'
import { soldierDropdownProps } from './parade-ui'

/**
 * Guard Duty for the selected date. Unlike the roster duties, any number of people can be
 * assigned; entries are stored as 'Guard Duty' exceptions.
 */
export default function GuardDutyPanel({ date, settings, data }: {
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
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-hairline bg-parchment px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">Guard Duty</h3>
        <Button
          size="sm"
          variant={showForm ? 'secondary' : 'primary'}
          onClick={() => {
            if (!showForm) setForm({ name: '', reason: '' })
            setShowForm((v) => !v)
          }}
        >
          {showForm ? 'Cancel' : '+ Add'}
        </Button>
      </div>

      {showForm && (
        <div className="space-y-3 border-b border-hairline bg-parchment/50 p-4">
          <Field label="Role">
            <Select value={form.reason} onChange={(e) => setForm(withRole(form, e.target.value))}>{roleOptions}</Select>
          </Field>
          <Field label="Soldier" required>
            <SearchDropdown
              {...soldierDropdownProps}
              items={eligibleFor(form.reason)}
              value={form.name}
              onChange={(name) => setForm({ ...form, name })}
              inputClass={inputClass()}
              disabled={!form.reason}
            />
          </Field>
          <Button block onClick={add} disabled={!form.name}>Add Guard Duty</Button>
        </div>
      )}

      {entries.length === 0 ? (
        <Empty className="py-8">No Guard Duty entries for this date.</Empty>
      ) : (
        <Table bare head={<><Th>Role</Th><Th>Name</Th><th /></>}>
          {entries.map((e, i) => {
            const isEditing = edit?.id === e.id
            return (
              <tr key={e.id} className={rowClass(i, isEditing)}>
                {isEditing && edit ? (
                  <>
                    <td className={TD_EDIT}>
                      <Select compact value={edit.reason ?? ''} onChange={(ev) => setEdit(withRole(edit, ev.target.value))}>{roleOptions}</Select>
                    </td>
                    <td className={TD_EDIT}>
                      <SearchDropdown
                        {...soldierDropdownProps}
                        items={eligibleFor(edit.reason ?? '')}
                        value={edit.name}
                        onChange={(name) => setEdit({ ...edit, name })}
                        inputClass={inputClass({ compact: true })}
                        disabled={!edit.reason}
                      />
                    </td>
                    <td className={TD_EDIT}>
                      <EditActions onSave={save} onCancel={() => setEdit(null)} />
                    </td>
                  </>
                ) : (
                  <>
                    <td className={`${TD} text-ink-60`}>{e.reason ?? '–'}</td>
                    <td className={`${TD} font-medium`}>{displayName(e.name, soldiers)}</td>
                    <td className={TD}>
                      <RowActions
                        confirming={confirm.isConfirming(e.id)}
                        onEdit={() => setEdit({ ...e })}
                        onRequest={() => confirm.request(e.id)}
                        onConfirm={() => confirm.resolve(() => mutate(() => repos.exceptions.remove(e.id)))}
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
      )}
    </Card>
  )
}
