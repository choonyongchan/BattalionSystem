'use client'

import { useMemo, useRef, useState, type Ref } from 'react'
import type { Company } from '@/shared/companies'
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

  if (data.loading) return <div className="text-ink-60 text-sm py-8 text-center">Loading...</div>

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

      {/* Segmented control: the four steps of preparing a parade state */}
      <div className="grid grid-cols-4 gap-1 rounded-pill bg-hairline/60 p-1">
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

      {section === 'config' && <ConfigSection company={company} paradeTimes={paradeTimes} data={data} />}
      {section === 'duties' && <DutiesSection company={company} date={date} setDate={setDate} settings={settings} data={data} />}
      {section === 'exceptions' && <ExceptionsSection date={date} settings={settings} data={data} />}
      {section === 'generate' && (
        <GenerateSection company={company} companyLabel={companyLabel} paradeTimes={paradeTimes} data={data} onGenerated={showReport} />
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
        <h3 className="text-sm font-medium text-ink-80">{title}</h3>
        <button onClick={copy} className="text-xs px-3 py-2 border border-hairline rounded-lg hover:bg-parchment transition-colors text-ink-80">
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <textarea
        readOnly
        value={text}
        aria-label="Parade state report"
        rows={Math.min(30, text.split('\n').length + 2)}
        className="w-full font-mono text-sm text-ink bg-white border border-hairline p-4 rounded-card resize-none"
      />
    </div>
  )
}
