'use client'

import { RANK_ORDER, type RankRule } from '@/shared/ranks'
import { isRankRangeInvalid } from '@/backend/domain/duty/duty-rules'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/frontend/components/ui/select'

/** From–to rank selects, with an error when the range matches nobody. */
export default function RankRangePicker({ rule, onChange }: { rule: RankRule; onChange: (rule: RankRule) => void }) {
  /** One end of the range. */
  const end = (value: string, set: (v: string) => void) => (
    <Select value={value} onValueChange={(v) => v && set(v)}>
      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
      <SelectContent>{RANK_ORDER.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
    </Select>
  )
  return (
    <div>
      <div className="flex items-center gap-2">
        {end(rule.from, (from) => onChange({ ...rule, from }))}
        <span className="text-xs text-ink-60">–</span>
        {end(rule.to, (to) => onChange({ ...rule, to }))}
      </div>
      {isRankRangeInvalid(rule) && (
        <p className="text-xs text-danger mt-1">&quot;From&quot; rank must not come after &quot;to&quot; rank.</p>
      )}
    </div>
  )
}
