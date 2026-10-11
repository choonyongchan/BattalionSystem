'use client'

import { ALL_RANKS } from '@/shared/ranks'
import SearchDropdown from '@/frontend/components/shared/SearchDropdown'

/** Searchable rank picker showing each rank with its rank type. */
export default function RankDropdown({ value, onChange, inputClass }: {
  value: string
  onChange: (rank: string) => void
  inputClass: string
}) {
  return (
    <SearchDropdown
      items={ALL_RANKS}
      value={value}
      getKey={(r) => r.rank}
      getLabel={(r) => r.rank}
      matches={(r, q) => r.rank.toLowerCase().startsWith(q.toLowerCase())}
      renderOption={(r) => (
        <div className="flex gap-3 items-center">
          <span className="font-mono font-medium text-gray-800 w-14 shrink-0">{r.rank}</span>
          <span className="text-xs text-gray-400">{r.type}</span>
        </div>
      )}
      onChange={onChange}
      inputClass={inputClass}
      placeholder="e.g. CPL, 3SG, LTA"
    />
  )
}
