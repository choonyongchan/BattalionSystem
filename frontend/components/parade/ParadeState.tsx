'use client'

import { useMemo, useRef, useState } from 'react'
import type { Company } from '@/shared/companies'
import { todaySGDate } from '@/shared/dates'
import { exceptionSoldierKey, isActiveOn, soldierIndex, soldierKeyOf } from '@/backend/domain/exceptions/active'
import { useSettingsQuery } from '@/frontend/hooks/queries'
import MessageBox from '@/frontend/components/shared/MessageBox'
import { Banner, Loading, PageHeader } from '@/frontend/components/ui/layout'
import { Segmented } from '@/frontend/components/ui/segmented'
import { useParadeData } from '@/frontend/hooks/useParadeData'
import type { ParadeType } from './parade-ui'
import DutiesSection from './DutiesSection'
import ExceptionsSection from './ExceptionsSection'
import GenerateSection from './GenerateSection'

type Section = 'duties' | 'exceptions' | 'generate'

const SECTIONS: { value: Section; label: string }[] = [
  { value: 'duties', label: 'Duties' },
  { value: 'exceptions', label: 'Exceptions' },
  { value: 'generate', label: 'Generate' },
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

  if (data.loading || !settings) return <Loading />

  return (
    <div className="space-y-3">
      <PageHeader
        title="Parade State"
        subtitle={<>
          {soldiers.length - absentCount} / {soldiers.length} present
          {activeOnDate.length > 0 && ` · ${activeOnDate.length} exception${activeOnDate.length !== 1 ? 's' : ''}`}
        </>}
      />

      {data.error && <Banner>{data.error}</Banner>}

      {/* The three steps of preparing a parade state */}
      <Segmented aria-label="Section" value={section} onChange={setSection} options={SECTIONS} />

      {section === 'duties' && <DutiesSection date={date} setDate={setDate} settings={settings} data={data} />}
      {section === 'exceptions' && <ExceptionsSection date={date} settings={settings} data={data} />}
      {section === 'generate' && (
        <GenerateSection company={company} settings={settings} data={data} onGenerated={showReport} />
      )}

      {report && <div ref={reportRef}><MessageBox title={`Report – ${report.paradeType}`} text={report.text} /></div>}
    </div>
  )
}
