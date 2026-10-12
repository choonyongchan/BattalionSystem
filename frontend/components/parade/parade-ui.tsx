import type { Soldier } from '@/shared/types'
import type { ExceptionScope } from '@/backend/domain/exceptions/exception-validation'

/** Placeholder hints for the reason field, per scope. */
export const REASON_HINTS: Record<ExceptionScope, string> = {
  'Att C': 'e.g. Flu, Fever',
  'Status': 'e.g. Excuse RMJ, Excuse Uniform',
  'Off/Leave': 'e.g. Annual Leave, Off',
  'Guard Duty': 'e.g. Regimental Guard, Guard Commander',
  'Report Sick': 'e.g. Flu, Fever',
  'MA': 'e.g. Skin Appt, IMH Appt',
  'Others': 'e.g. ...',
}

export const PARADE_TYPES = ['First Parade', 'Last Parade'] as const
export type ParadeType = (typeof PARADE_TYPES)[number]

/** Shared SearchDropdown props for picking a soldier by rank and name. */
export const soldierDropdownProps = {
  getKey: (s: Soldier) => s.name,
  getLabel: (s: Soldier) => `${s.rank} ${s.name}`.trim(),
  matches: (s: Soldier, q: string) => `${s.rank} ${s.name}`.toLowerCase().includes(q.toLowerCase()),
  renderOption: (s: Soldier) => (
    <div className="flex gap-2">
      <span className="font-mono text-xs text-ink-60 w-12 shrink-0 pt-0.5">{s.rank}</span>
      <span className="font-medium text-ink">{s.name}</span>
    </div>
  ),
  placeholder: 'Search soldier...',
}
