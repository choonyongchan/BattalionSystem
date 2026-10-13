import type { ReactNode, ThHTMLAttributes } from 'react'
import { cn } from '@/shared/utils'
import { Button } from './button'

/** Body cell padding (read mode / inline-edit mode). */
export const TD = 'px-3 py-1.5 whitespace-nowrap'
export const TD_EDIT = 'px-2 py-1'

/** Zebra-striped row, tinted while being edited. */
export function rowClass(index: number, editing = false, extra?: string): string {
  return cn('border-b border-hairline last:border-0', index % 2 === 1 && 'bg-parchment/50', editing && 'bg-action/5', extra)
}

/**
 * Scrollable table on a white card. `bare` drops the card when the table sits inside one.
 * @param head The header cells (Th / SortTh).
 */
export function Table({ head, bare, className, children }: { head: ReactNode; bare?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={cn(!bare && 'overflow-hidden rounded-card border border-hairline bg-white', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline bg-parchment">{head}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
}

/** Header cell. */
export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('px-3 py-1.5 text-left font-medium whitespace-nowrap text-ink-60', className)} {...props} />
}

/** Sortable header cell; `dir` null means not sorted by this column. */
export function SortTh({ label, dir, onSort, className }: { label: ReactNode; dir: 'asc' | 'desc' | null; onSort: () => void; className?: string }) {
  return (
    <Th className={className} aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
      <button type="button" onClick={onSort} className="inline-flex items-center gap-1 transition-colors hover:text-ink-80">
        {label}
        <span aria-hidden className="text-[10px] text-ink-48">{dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '⇅'}</span>
      </button>
    </Th>
  )
}

/**
 * Edit / delete buttons for a row, swapping to Yes / No while a delete awaits confirmation.
 * Omit `onEdit` or `onRequest` to hide that button.
 */
export function RowActions({ confirming, onEdit, onRequest, onConfirm, onCancel, disabled, editLabel = 'Edit', removeTitle = 'Remove', confirmTitle = 'Confirm delete' }: {
  confirming: boolean
  onEdit?: () => void
  onRequest?: () => void
  onConfirm: () => void
  onCancel: () => void
  disabled?: boolean
  editLabel?: string
  removeTitle?: string
  confirmTitle?: string
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {confirming ? (
        <>
          <Button variant="danger" size="sm" onClick={onConfirm} disabled={disabled} title={confirmTitle}>Yes</Button>
          <Button variant="soft" size="sm" onClick={onCancel} disabled={disabled} title="Cancel">No</Button>
        </>
      ) : (
        <>
          {onEdit && <Button variant="icon" onClick={onEdit} disabled={disabled} title="Edit" aria-label={editLabel}>✎</Button>}
          {onRequest && <Button variant="icon-danger" onClick={onRequest} disabled={disabled} title={removeTitle} aria-label={removeTitle}>✕</Button>}
        </>
      )}
    </div>
  )
}

/** Save / Cancel for a row in inline edit. */
export function EditActions({ onSave, onCancel, saving, disabled }: { onSave: () => void; onCancel: () => void; saving?: boolean; disabled?: boolean }) {
  return (
    <div className="flex justify-end gap-1">
      <Button size="sm" onClick={onSave} disabled={saving || disabled}>{saving ? '…' : 'Save'}</Button>
      <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
    </div>
  )
}
