'use client'

import { useMemo, useRef, useState, type Ref } from 'react'
import type { Company } from '@/shared/companies'
import { COMPANY_THEMES } from '@/shared/companies'
import { todaySGDate } from '@/shared/dates'
import { exceptionSoldierKey, isActiveOn, soldierIndex, soldierKeyOf } from '@/backend/domain/exceptions/active'
import { useSettingsQuery } from '@/frontend/hooks/useSettings'
import { useParadeData } from '@/frontend/hooks/useParadeData'
import type { ParadeType } from './parade-ui'
import ConfigSection from './ConfigSection'
import DutiesSection from './DutiesSection'
import ExceptionsSection from './ExceptionsSection'
import GenerateSection from './GenerateSection'

type Section = 'config' | 'duties' | 'exceptions' | 'generate'

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'config', label: 'Config' },
  { id: 'duties', label: 'Duties' },
  { id: 'exceptions', label: 'Exceptions' },
  { id: 'generate', label: 'Generate' },
]

/** Parade State tab: config, duties, exceptions and report generation for one company. */
export default function ParadeState({ company, companyLabel }: { company: Company; companyLabel: string }) {
  const theme = COMPANY_THEMES[company]
  const [date, setDate] = useState(todaySGDate())
  const [section, setSection] = useState<Section>('config')
  const [report, setReport] = useState<{ text: string; paradeType: ParadeType } | null>(null)
  const reportRef = useRef<HTMLDivElement>(null)
  const { data: settings } = useSettingsQuery(company)
  const data = useParadeData(company, date)
  const paradeTimes = settings?.parade_times ?? {}
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

  if (data.loading) return <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-gray-800">Parade State</h2>
        <p className="text-xs text-gray-500">
          {soldiers.length - absentCount} / {soldiers.length} present
          {activeOnDate.length > 0 && ` · ${activeOnDate.length} exception${activeOnDate.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {data.error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{data.error}</div>
      )}

      <div className="flex border-b border-gray-200">
        {SECTIONS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            aria-current={section === t.id ? 'page' : undefined}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${section === t.id
              ? `${theme.activeBorder} ${theme.activeText}`
              : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {section === 'config' && <ConfigSection company={company} theme={theme} paradeTimes={paradeTimes} data={data} />}
      {section === 'duties' && <DutiesSection company={company} theme={theme} date={date} setDate={setDate} settings={settings} data={data} />}
      {section === 'exceptions' && <ExceptionsSection theme={theme} date={date} settings={settings} data={data} />}
      {section === 'generate' && (
        <GenerateSection company={company} companyLabel={companyLabel} theme={theme} paradeTimes={paradeTimes} data={data} onGenerated={showReport} />
      )}

      {report && <ReportOutput ref={reportRef} text={report.text} title={`Report – ${report.paradeType}`} />}
    </div>
  )
}

/** Generated report text with a copy button. */
function ReportOutput({ ref, text, title }: { ref: Ref<HTMLDivElement>; text: string; title: string }) {
  const [copied, setCopied] = useState(false)

  /** Copies the report to the clipboard. */
  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div ref={ref} className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        <button onClick={copy} className="text-xs px-3 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-gray-600">
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <textarea
        readOnly
        value={text}
        aria-label="Parade state report"
        rows={Math.min(30, text.split('\n').length + 2)}
        className="w-full font-mono text-xs bg-gray-900 text-green-400 p-4 rounded-2xl resize-none focus:outline-none"
      />
    </div>
  )
}
