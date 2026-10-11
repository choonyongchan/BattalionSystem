'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Company, CompanyTheme } from '@/shared/companies'
import { PARADE_CONFIG } from '@/shared/companies'
import { RANK_TYPES } from '@/shared/ranks'
import { anyMismatch, computeStrength, strWarn } from '@/backend/domain/parade/strength'
import type { ParadeData } from '@/frontend/hooks/useParadeData'
import { PARADE_TYPES } from './parade-ui'

/** Parade times summary plus the strength-override grid (auto-saves on blur). */
export default function ConfigSection({ company, theme, paradeTimes, data }: {
  company: Company
  theme: CompanyTheme
  paradeTimes: Record<string, string>
  data: ParadeData
}) {
  const [open, setOpen] = useState(false)
  const { soldiers, strInputs, setStrInputs, saveStrengthCell } = data
  const platoons = useMemo(() => ['Total', 'HQ', ...PARADE_CONFIG[company].platoons.map((p) => p.key)], [company])
  const computed = useMemo(() => computeStrength(soldiers, platoons), [soldiers, platoons])

  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <p className="text-sm text-gray-600">
          {PARADE_TYPES.map((pt) => `${pt} ${paradeTimes[pt] ?? '–'}`).join(' · ')}
          {' — edit in '}
          <Link href={`/${company}/settings`} className={`${theme.activeText} underline`}>Settings</Link>
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            Overwrite Strength
            {anyMismatch(platoons, RANK_TYPES, strInputs, computed) && (
              <span className="text-yellow-500 text-base leading-none" title="Some overrides differ from nominal roll">✏️</span>
            )}
          </span>
          <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
        </button>

        {open && (
          <div className="border-t border-gray-100 p-4 space-y-3">
            <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-400 pb-1">
              <span />
              {RANK_TYPES.map((rt) => <span key={rt} className="text-center">{rt}</span>)}
            </div>
            {platoons.map((platoon) => (
              <div key={platoon} className="grid grid-cols-4 gap-2 items-center">
                <span className="text-xs font-medium text-gray-600">
                  {platoon === 'Total' ? 'Total Coy' : platoon === 'HQ' ? 'HQ' : `PLT ${platoon}`}
                </span>
                {RANK_TYPES.map((rt) => {
                  const warn = strWarn(platoon, rt, strInputs, computed)
                  return (
                    <input
                      key={rt}
                      type="number"
                      min="0"
                      aria-label={`${platoon} ${rt} strength`}
                      placeholder={String(computed[platoon]?.[rt] ?? 0)}
                      value={strInputs[platoon]?.[rt] ?? ''}
                      title={warn ?? undefined}
                      onChange={(e) => {
                        const val = e.target.value
                        setStrInputs((prev) => ({ ...prev, [platoon]: { ...prev[platoon], [rt]: val } }))
                      }}
                      onBlur={(e) => saveStrengthCell(platoon, rt, e.target.value)}
                      className={`w-full border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 ${theme.focusRing} ${warn ? 'border-amber-300 ring-2 ring-amber-100' : 'border-gray-300'}`}
                    />
                  )
                })}
              </div>
            ))}
            <p className="text-xs text-gray-400 pt-1">Placeholders show nominal roll counts. Edits auto-save on blur.</p>
          </div>
        )}
      </div>
    </div>
  )
}
