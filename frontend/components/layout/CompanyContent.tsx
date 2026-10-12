'use client'

import { useEffect, useState } from 'react'
import type { Company } from '@/shared/companies'
import NominalRoll from '@/frontend/components/nominal-roll/NominalRoll'
import ParadeState from '@/frontend/components/parade/ParadeState'
import DutyDashboard from '@/frontend/components/dashboard/DutyDashboard'
import OffLeaveTracking from '@/frontend/components/off-leave/OffLeaveTracking'
import ConductsTab from '@/frontend/components/conducts/ConductsTab'
import ReportSickTab from '@/frontend/components/report-sick/ReportSickTab'
import CompanyShell from './CompanyShell'
import TabBar, { isTabId, type TabId } from './TabBar'

const DEFAULT_TAB: TabId = 'dashboard'

/** Reads the tab from ?tab= so a tab can be bookmarked or shared. */
function tabFromUrl(): TabId {
  const tab = new URLSearchParams(window.location.search).get('tab')
  return isTabId(tab) ? tab : DEFAULT_TAB
}

/** A company's tabbed workspace, gated behind commander login. */
export default function CompanyContent({ company, label }: { company: Company; label: string }) {
  return (
    <CompanyShell company={company} label={label}>
      <Workspace company={company} label={label} />
    </CompanyShell>
  )
}

/** Grouped tab bar plus the selected tab's panel; the tab is mirrored into the URL. */
function Workspace({ company, label }: { company: Company; label: string }) {
  const [tab, setTab] = useState<TabId>(DEFAULT_TAB)

  // Static export: the query string is only known in the browser
  useEffect(() => setTab(tabFromUrl()), [])

  /** Switches tab and records it in the URL without a navigation. */
  function select(id: TabId) {
    setTab(id)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', id)
    window.history.replaceState(null, '', url)
  }

  return (
    <>
      <TabBar active={tab} onSelect={select} />
      <main id="workspace-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 sm:px-6">
        {tab === 'dashboard' && <DutyDashboard company={company} />}
        {tab === 'nominal-roll' && <NominalRoll company={company} />}
        {tab === 'parade-state' && <ParadeState company={company} companyLabel={label} />}
        {tab === 'report-sick' && <ReportSickTab company={company} companyLabel={label} />}
        {tab === 'conducts' && <ConductsTab company={company} companyLabel={label} />}
        {tab === 'off-leave' && <OffLeaveTracking company={company} />}
      </main>
    </>
  )
}
