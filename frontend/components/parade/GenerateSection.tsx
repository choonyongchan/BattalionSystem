'use client'

import { useState } from 'react'
import { track } from '@vercel/analytics'
import type { Company } from '@/shared/companies'
import { todaySGDate } from '@/shared/dates'
import { isActiveOn } from '@/backend/domain/exceptions/active'
import { generateParadeReport } from '@/backend/domain/parade/parade-report'
import { applyExcludeStayIn } from '@/backend/domain/parade/exception-table'
import type { AppSettings } from '@/backend/domain/settings/settings'
import type { ParadeData } from '@/frontend/hooks/useParadeData'
import { PARADE_TYPES, type ParadeType } from './parade-ui'
import { THEME } from '@/frontend/theme'

/**
 * Parade options and the Generate button. The report is always for today, whatever duty
 * date is selected; the text is handed to `onGenerated`.
 */
export default function GenerateSection({ company, settings, data, onGenerated }: {
  company: Company
  settings: AppSettings
  data: ParadeData
  onGenerated: (report: string, paradeType: ParadeType) => void
}) {
  const [paradeType, setParadeType] = useState<ParadeType>('First Parade')
  const [excludeStayIn, setExcludeStayIn] = useState(false)

  /** Builds today's parade state report from current data and the chosen options. */
  async function generate() {
    const today = todaySGDate()
    const { data: duties } = await data.repos.duties.listOn(today)
    const active = data.exceptions.filter((e) => isActiveOn(e, today))
    const report = generateParadeReport({
      date: today,
      soldiers: data.allSoldiers,
      // Excluding stay-in = count them absent; their STATUS lines still print
      activeExceptions: applyExcludeStayIn(active, excludeStayIn),
      paradeTimeStr: settings.parade_times[paradeType] ?? '',
      duties,
      paradeType,
    }, { companyName: company.toUpperCase(), platoons: settings.platoons })
    onGenerated(report, paradeType)
    track('parade_state_generated', { company, soldierCount: data.soldiers.length, date: today, paradeType, excludeStayIn })
  }

  return (
    <div className="space-y-3">
      <div className="bg-white border border-hairline rounded-card p-4 space-y-4">
        <fieldset>
          <legend className="text-xs text-ink-60 mb-2">Parade</legend>
          <div className="flex gap-4">
            {PARADE_TYPES.map((pt) => (
              <label key={pt} className="flex items-center gap-2 text-sm text-ink-80 cursor-pointer">
                <input type="radio" name="paradeType" className="h-4 w-4" checked={paradeType === pt} onChange={() => setParadeType(pt)} />
                {pt}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-xs text-ink-60 mb-2">Exclude Excuse Stay-In Personnel</legend>
          <div className="flex gap-4">
            {([['No', false], ['Yes', true]] as const).map(([label, value]) => (
              <label key={label} className="flex items-center gap-2 text-sm text-ink-80 cursor-pointer">
                <input type="radio" name="excludeStayIn" className="h-4 w-4" checked={excludeStayIn === value} onChange={() => setExcludeStayIn(value)} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <button
        onClick={generate}
        className={`w-full py-4 ${THEME.buttonBg} ${THEME.buttonHoverBg} text-white font-semibold rounded-card transition-colors text-sm tracking-wide`}
      >
        Generate Parade State
      </button>
    </div>
  )
}
