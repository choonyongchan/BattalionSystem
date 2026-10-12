'use client'

import { useState } from 'react'
import type { Company } from '@/shared/companies'
import { useSettingsQuery, usePublicHolidaysQuery } from '@/frontend/hooks/queries'
import CompanyShell from '@/frontend/components/layout/CompanyShell'
import DutyWeightsSection from './DutyWeightsSection'
import ParadeTimesSection from './ParadeTimesSection'
import EligibilitySection from './EligibilitySection'
import GuardDutyRolesSection from './GuardDutyRolesSection'
import AbsenceDefaultsSection from './AbsenceDefaultsSection'
import PublicHolidaysSection from './PublicHolidaysSection'
import { ConductsSection, DutyRosterSection, OverviewSection, PlatoonsSection, ReportSickSection } from './CompanySections'

type SettingsTab =
  | 'platoons' | 'duty-roster' | 'duty-weights' | 'parade-times' | 'eligibility' | 'guard-duty-roles'
  | 'absence-defaults' | 'report-sick' | 'conducts' | 'overview' | 'public-holidays'

const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: 'platoons', label: 'Platoons' },
  { id: 'duty-roster', label: 'Duty Roster' },
  { id: 'duty-weights', label: 'Duty Weights' },
  { id: 'parade-times', label: 'Parade Times' },
  { id: 'eligibility', label: 'Duty Eligibility' },
  { id: 'guard-duty-roles', label: 'Guard Duty Roles' },
  { id: 'absence-defaults', label: 'Absence Defaults' },
  { id: 'report-sick', label: 'Report Sick' },
  { id: 'conducts', label: 'Conducts' },
  { id: 'overview', label: 'Overview' },
  { id: 'public-holidays', label: 'Public Holidays' },
]

/** A company's settings page, one section per setting group, behind commander login. */
export default function SettingsPage({ company, label }: { company: Company; label: string }) {
  return (
    <CompanyShell company={company} label={label}>
      <SettingsContent company={company} />
    </CompanyShell>
  )
}

/** Settings section picker and the chosen section's form. */
function SettingsContent({ company }: { company: Company }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('duty-weights')
  const { data: settings, isLoading: settingsLoading } = useSettingsQuery(company)
  const { data: publicHolidays, isLoading: holidaysLoading } = usePublicHolidaysQuery()

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] md:py-8">
      <h1 className="mb-4 text-2xl font-bold text-ink md:mb-6 md:text-3xl">Settings</h1>
      {settingsLoading || holidaysLoading || !settings ? (
        <p role="status" className="py-8 text-center text-sm text-ink-60">Loading...</p>
      ) : (
        <>
          <div role="tablist" aria-label="Settings sections" className="-mx-4 mb-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`h-11 shrink-0 snap-start whitespace-nowrap rounded-pill px-4 text-sm ${activeTab === tab.id
                  ? 'bg-action font-semibold text-white'
                  : 'bg-parchment text-ink-80 hover:text-ink'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="rounded-card border border-hairline bg-white p-4 shadow-sm md:p-6">
            {activeTab === 'platoons' && <PlatoonsSection company={company} settings={settings} />}
            {activeTab === 'duty-roster' && <DutyRosterSection company={company} settings={settings} />}
            {activeTab === 'duty-weights' && <DutyWeightsSection company={company} settings={settings} />}
            {activeTab === 'parade-times' && <ParadeTimesSection company={company} settings={settings} />}
            {activeTab === 'eligibility' && <EligibilitySection company={company} settings={settings} />}
            {activeTab === 'guard-duty-roles' && <GuardDutyRolesSection company={company} settings={settings} />}
            {activeTab === 'absence-defaults' && <AbsenceDefaultsSection company={company} settings={settings} />}
            {activeTab === 'report-sick' && <ReportSickSection company={company} settings={settings} />}
            {activeTab === 'conducts' && <ConductsSection company={company} settings={settings} />}
            {activeTab === 'overview' && <OverviewSection company={company} settings={settings} />}
            {activeTab === 'public-holidays' && (
              <div>
                <p className="mb-3 text-sm text-ink-60">Shared across all companies</p>
                <PublicHolidaysSection publicHolidays={publicHolidays ?? []} />
              </div>
            )}
          </div>
        </>
      )}
    </main>
  )
}
