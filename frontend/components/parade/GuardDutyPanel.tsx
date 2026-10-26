'use client'

import { useState } from 'react'
import { displayName } from '@/shared/names'
import { GUARD_DUTY_ROLES, guardRankRule } from '@/shared/guard-duty'
import type { AppSettings } from '@/backend/domain/settings/settings'
import { isInRange } from '@/backend/domain/duty/duty-rules'
import { useConfirmDelete } from '@/frontend/hooks/useConfirmDelete'
import type { ParadeData } from '@/frontend/hooks/useParadeData'
import SearchDropdown from '@/frontend/components/shared/SearchDropdown'
import { inputClass } from '@/frontend/components/ui/fields'
import { Card } from '@/frontend/components/ui/layout'
import { EditActions, RowActions, TD, TD_EDIT, Table, Th, rowClass } from '@/frontend/components/ui/table'
import { soldierDropdownProps } from './parade-ui'

/**
 * Guard Duty for the selected date: one optional person per role (CDOS, GC, G2, RG1-RG6),
 * each stored as a duty in the Duty table so it is never purged.
 */
export default function GuardDutyPanel({ date, settings, data }: {
  date: string
  settings: AppSettings | undefined
  data: ParadeData
}) {
  const { soldiers, duties, repos, mutate } = data
  const [edit, setEdit] = useState<{ role: string; name: string } | null>(null)
  const confirm = useConfirmDelete<string>()

  /** Soldiers whose rank fits the role's rank range (settings override, else default). */
  const eligibleFor = (role: string) => {
    const rule = guardRankRule(role, settings?.guard_duty_rank_overrides ?? {})
    return rule ? soldiers.filter((s) => isInRange(rule, s.rank)) : soldiers
  }

  /** Saves the picked soldier for the role on the selected date. */
  async function save() {
    if (!edit?.name) return
    if (await mutate(() => repos.duties.upsert({ duty_type: edit.role, date, name: edit.name.toUpperCase() }))) setEdit(null)
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-hairline bg-parchment px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">Guard Duty</h3>
      </div>
      <Table bare head={<><Th>Role</Th><Th>Name</Th><th /></>}>
        {GUARD_DUTY_ROLES.map((role, i) => {
          const d = duties.find((x) => x.duty_type === role && x.date === date)
          const isEditing = edit?.role === role
          return (
            <tr key={role} className={rowClass(i, isEditing)}>
              {isEditing && edit ? (
                <>
                  <td className={`${TD_EDIT} font-medium`}>{role}</td>
                  <td className={TD_EDIT}>
                    <SearchDropdown
                      {...soldierDropdownProps}
                      items={eligibleFor(role)}
                      value={edit.name}
                      onChange={(name) => setEdit({ role, name })}
                      inputClass={inputClass({ compact: true })}
                    />
                  </td>
                  <td className={TD_EDIT}>
                    <EditActions onSave={save} onCancel={() => setEdit(null)} />
                  </td>
                </>
              ) : (
                <>
                  <td className={`${TD} font-medium`}>{role}</td>
                  <td className={`${TD} ${d ? '' : 'text-ink-48'}`}>{d ? displayName(d.name, soldiers) : '–'}</td>
                  <td className={TD}>
                    <RowActions
                      confirming={confirm.isConfirming(role)}
                      onEdit={() => setEdit({ role, name: d?.name ?? '' })}
                      onRequest={d ? () => confirm.request(role) : undefined}
                      onConfirm={() => confirm.resolve(() => mutate(() => repos.duties.remove(role, date)))}
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
    </Card>
  )
}
