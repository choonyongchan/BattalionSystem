'use client'

import { RANK_ORDER, type RankRule } from '@/shared/ranks'
import { isRankRangeInvalid } from '@/backend/domain/duty/duty-rules'
import { Select } from '@/frontend/components/ui/fields'

/** From–to rank selects, with an error when the range matches nobody. */
export default function RankRangePicker({ rule, onChange }: { rule: RankRule; onChange: (rule: RankRule) => void }) {
  /** One end of the range. */
  const end = (value: string, set: (v: string) => void, label: string) => (
    <Select aria-label={label} className="flex-1" value={value} onChange={(e) => set(e.target.value)}>
      {RANK_ORDER.map((r) => <option key={r} value={r}>{r}</option>)}
    </Select>
  )
  return (
    <div>
      <div className="flex items-center gap-2">
        {end(rule.from, (from) => onChange({ ...rule, from }), 'From rank')}
        <span className="text-xs text-ink-60">–</span>
        {end(rule.to, (to) => onChange({ ...rule, to }), 'To rank')}
      </div>
      {isRankRangeInvalid(rule) && (
        <p role="alert" className="mt-1 text-xs text-danger">&quot;From&quot; rank must not come after &quot;to&quot; rank.</p>
      )}
    </div>
  )
}
