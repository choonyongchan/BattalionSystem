'use client'

import { useMemo, useRef, useState } from 'react'
import type { Company } from '@/shared/companies'
import { todaySGDate } from '@/shared/dates'
import { exceptionSoldierKey, isActiveOn, soldierIndex, soldierKeyOf } from '@/backend/domain/exceptions/active'
import { useSettingsQuery } from '@/frontend/hooks/queries'
import MessageBox from '@/frontend/components/shared/MessageBox'
import { useParadeData } from '@/frontend/hooks/useParadeData'
import type { ParadeType } from './parade-ui'
import DutiesSection from './DutiesSection'
import ExceptionsSection from './ExceptionsSection'
import GenerateSection from './GenerateSection'

type Section = 'duties' | 'exceptions' | 'generate'

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'duties', label: 'Duties' },
  { id: 'exceptions', label: 'Exceptions' },
  { id: 'generate', label: 'Generate' },
]

/** Parade State tab: duties, exceptions and report generation for one company. */
export default function ParadeState({ company }: { company: Company }) {
  const [date, setDate] = useState(todaySGDate())
  const [section, setSection] = useState<Section>('duties')
  const [report, setReport] = useState<{ text: string; paradeType: ParadeType } | null>(null)
  const reportRef = useRef<HTMLDivElement>(null)
  const { data: settings } = useSettingsQuery(company)
  const data = useParadeData(company, date)
  const { soldiers, exceptions } = data

  const activeOnDate = useMemo(() => exceptions.filter((e) => isActiveOn(e, date)), [exceptions, date])
  const absentCount = useMemo(() => {
    const idx = soldierIndex(soldiers)
    const absent = new Set(activeOnDate.filter((e) => e.counts_as_absence).map((e) => exceptionSoldierKey(e, idx)))
    return soldiers.filter((s) => absent.has(soldierKeyOf(s))).length
  }, [soldiers, activeOnDate])

  /** Shows a freshly generated report and scrolls to it. */
  function showReport(text: string, paradeType: ParadeType) {
    setReport({ text, paradeType })
    setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  if (data.loading || !settings) return <div className="text-ink-60 text-sm py-8 text-center">Loading...</div>

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-ink">Parade State</h2>
        <p className="text-xs text-ink-60">
          {soldiers.length - absentCount} / {soldiers.length} present
          {activeOnDate.length > 0 && ` · ${activeOnDate.length} exception${activeOnDate.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {data.error && (
        <div role="alert" className="bg-danger/5 border border-danger/30 text-danger px-4 py-3 rounded-lg text-sm">{data.error}</div>
      )}

      {/* Segmented control: the three steps of preparing a parade state */}
      <div className="grid grid-cols-3 gap-1 rounded-pill bg-hairline/60 p-1">
        {SECTIONS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            aria-current={section === t.id ? 'step' : undefined}
            className={`h-9 rounded-pill text-sm ${section === t.id ? 'bg-white font-semibold text-ink' : 'text-ink-80 hover:text-ink'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {section === 'duties' && <DutiesSection date={date} setDate={setDate} settings={settings} data={data} />}
      {section === 'exceptions' && <ExceptionsSection date={date} settings={settings} data={data} />}
      {section === 'generate' && (
        <GenerateSection company={company} settings={settings} data={data} onGenerated={showReport} />
      )}

      {report && <div ref={reportRef}><MessageBox title={`Report – ${report.paradeType}`} text={report.text} /></div>}
    </div>
  )
}
