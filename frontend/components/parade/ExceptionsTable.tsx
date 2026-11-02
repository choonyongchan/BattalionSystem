'use client'

import React, { useState } from 'react'
import type { Exception, Soldier } from '@/shared/types'
import { toSGDate } from '@/shared/dates'
import { buildExceptionGroups, type ExceptionSort } from '@/backend/domain/parade/exception-table'
import { useConfirmDelete } from '@/frontend/hooks/useConfirmDelete'
import type { ParadeData } from '@/frontend/hooks/useParadeData'
import { Checkbox } from '@/frontend/components/ui/fields'
import { Badge } from '@/frontend/components/ui/layout'
import { RowActions, SortTh, TD, Table, Th, rowClass } from '@/frontend/components/ui/table'

/** Cycles a column's sort: ascending, descending, then off. */
function nextSort(prev: ExceptionSort, column: 'start' | 'end'): ExceptionSort {
  if (!prev || prev.column !== column) return { column, dir: 'asc' }
  return prev.dir === 'asc' ? { column, dir: 'desc' } : null
}

/**
 * Exceptions grouped by scope and soldier (merged name cells), sortable by start/end,
 * with an edit button (opens the add form) and confirm-to-delete.
 */
export default function ExceptionsTable({ data, rows, onEdit }: {
  data: ParadeData
  rows: Exception[]
  onEdit: (e: Exception) => void
}) {
  const { soldiers, repos, mutate } = data
  const [sort, setSort] = useState<ExceptionSort>(null)
  const confirm = useConfirmDelete<number>()

  const groups = buildExceptionGroups(rows, sort, soldiers)
  /** Sortable column header for start or end date. */
  const sortHeader = (column: 'start' | 'end', label: string) => (
    <SortTh label={label} dir={sort?.column === column ? sort.dir : null} onSort={() => setSort((prev) => nextSort(prev, column))} />
  )

  let rowIdx = -1
  return (
    <Table head={<>
      <Th>4D</Th>
      <Th>Name</Th>
      <Th>Scope</Th>
      <Th>Reason</Th>
      {sortHeader('start', 'Start')}
      {sortHeader('end', 'End')}
      <Th>Absent?</Th>
      <th />
    </>}>
      {groups.map((group, gi) => (
          <React.Fragment key={`${group[0].scope}-${group[0].name}-${gi}`}>
            {group.map((e, ei) => {
              rowIdx++
              return (
                <tr key={e.id} id={`ex-${e.id}`} className={rowClass(rowIdx, false)}>
                  {ei === 0 && <ReadGroupCells soldiers={soldiers} e={e} rowSpan={group.length} />}
                  <td className="px-3 py-1.5 text-ink-60"><div className="w-max max-w-sm whitespace-normal">{e.reason ?? '–'}</div></td>
                  <td className={`${TD} text-xs text-ink-60`}>{e.start ? toSGDate(e.start) : '–'}</td>
                  <td className={`${TD} text-xs text-ink-60`}>{e.end ? toSGDate(e.end) : '–'}</td>
                  <td className={TD}><Checkbox checked={e.counts_as_absence} disabled /></td>
                  <td className={TD}>
                    <RowActions
                      confirming={confirm.isConfirming(e.id)}
                      onEdit={() => onEdit(e)}
                      onRequest={() => confirm.request(e.id)}
                      onConfirm={() => confirm.resolve(() => mutate(() => repos.exceptions.remove(e.id)))}
                      onCancel={confirm.cancel}
                    />
                  </td>
                </tr>
              )
            })}
          </React.Fragment>
      ))}
    </Table>
  )
}

/** Read-only 4D, name and scope cells shared by a soldier's rows in one scope. */
function ReadGroupCells({ soldiers, e, rowSpan }: { soldiers: Soldier[]; e: Exception; rowSpan?: number }) {
  const soldier = soldiers.find((s) => s.name === e.name)
  return (
    <>
      <td className={`${TD} font-mono text-xs text-ink-60`} rowSpan={rowSpan}>{soldier?.four_d ?? '–'}</td>
      <td className={`${TD} font-medium`} rowSpan={rowSpan}>{soldier?.rank ? `${soldier.rank} ${e.name}` : e.name}</td>
      <td className={TD} rowSpan={rowSpan}><Badge>{e.scope ?? '–'}</Badge></td>
    </>
  )
}
