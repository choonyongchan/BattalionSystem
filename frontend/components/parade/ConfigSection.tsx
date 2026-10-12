'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Company } from '@/shared/companies'
import { PARADE_CONFIG, companyHref } from '@/shared/companies'
import { RANK_TYPES } from '@/shared/ranks'
import { anyMismatch, computeStrength, strWarn } from '@/backend/domain/parade/strength'
import type { ParadeData } from '@/frontend/hooks/useParadeData'
import { PARADE_TYPES } from './parade-ui'
import { THEME } from '@/frontend/theme'

/** Parade times summary plus the strength-override grid (auto-saves on blur). */
export default function ConfigSection({ company, paradeTimes, data }: {
  company: Company
  paradeTimes: Record<string, string>
  data: ParadeData
}) {
  const [open, setOpen] = useState(false)
  const { soldiers, strInputs, setStrInputs, saveStrengthCell } = data
  const platoons = useMemo(() => ['Total', 'HQ', ...PARADE_CONFIG[company].platoons.map((p) => p.key)], [company])
  const computed = useMemo(() => computeStrength(soldiers, platoons), [soldiers, platoons])

  return (
    <div className="space-y-3">
      <div className="bg-white border border-hairline rounded-card p-4">
        <p className="text-sm text-ink-80">
          {PARADE_TYPES.map((pt) => `${pt} ${paradeTimes[pt] ?? '–'}`).join(' · ')}
          {' — edit in '}
          <Link href={companyHref(company, 'settings')} className={`${THEME.activeText} underline`}>Settings</Link>
        </p>
      </div>

      <div className="bg-white border border-hairline rounded-card overflow-hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-ink-80 hover:bg-parchment transition-colors"
        >
          <span className="flex items-center gap-2">
            Overwrite Strength
            {anyMismatch(platoons, RANK_TYPES, strInputs, computed) && (
              <span className="size-2 rounded-full bg-amber-500" title="Some overrides differ from nominal roll"><span className="sr-only">Some overrides differ from nominal roll</span></span>
            )}
          </span>
          <span className="text-ink-60 text-xs">{open ? '▲' : '▼'}</span>
        </button>

        {open && (
          <div className="border-t border-hairline p-4 space-y-3">
            <div className="grid grid-cols-4 gap-2 text-xs font-medium text-ink-60 pb-1">
              <span />
              {RANK_TYPES.map((rt) => <span key={rt} className="text-center">{rt}</span>)}
            </div>
            {platoons.map((platoon) => (
              <div key={platoon} className="grid grid-cols-4 gap-2 items-center">
                <span className="text-xs font-medium text-ink-80">
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
                      className={`w-full border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 ${THEME.focusRing} ${warn ? 'border-amber-300 ring-2 ring-amber-100' : 'border-hairline'}`}
                    />
                  )
                })}
              </div>
            ))}
            <p className="text-xs text-ink-60 pt-1">Placeholders show nominal roll counts. Edits auto-save on blur.</p>
          </div>
        )}
      </div>
    </div>
  )
}
