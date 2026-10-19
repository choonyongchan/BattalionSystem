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
import { Button } from '@/frontend/components/ui/button'
import { Card } from '@/frontend/components/ui/layout'
import { Segmented } from '@/frontend/components/ui/segmented'

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
    }, { companyName: company.toUpperCase(), platoons: settings.platoons, inOutScopes: settings.in_out_scopes })
    onGenerated(report, paradeType)
    track('parade_state_generated', { company, soldierCount: data.soldiers.length, date: today, paradeType, excludeStayIn })
  }

  return (
    <div className="space-y-3">
      <Card className="space-y-4 p-4">
        <Segmented label="Parade" value={paradeType} onChange={setParadeType} options={PARADE_TYPES} />
        <Segmented
          label="Exclude Excuse Stay-In Personnel"
          value={excludeStayIn}
          onChange={setExcludeStayIn}
          options={[{ value: false, label: 'No' }, { value: true, label: 'Yes' }]}
        />
      </Card>
      <Button block onClick={generate}>Generate Parade State</Button>
    </div>
  )
}
