'use client'

import { useState } from 'react'
import type { Company } from '@/shared/companies'
import { useSettingsQuery, usePublicHolidaysQuery } from '@/frontend/hooks/useSettings'
import CompanyShell from '@/frontend/components/layout/CompanyShell'
import DutyWeightsSection from './DutyWeightsSection'
import ParadeTimesSection from './ParadeTimesSection'
import EligibilitySection from './EligibilitySection'
import GuardDutyRolesSection from './GuardDutyRolesSection'
import AbsenceDefaultsSection from './AbsenceDefaultsSection'
import PublicHolidaysSection from './PublicHolidaysSection'

type SettingsTab = 'duty-weights' | 'parade-times' | 'eligibility' | 'guard-duty-roles' | 'absence-defaults' | 'public-holidays'

const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: 'duty-weights', label: 'Duty Weights' },
  { id: 'parade-times', label: 'Parade Times' },
  { id: 'eligibility', label: 'Duty Eligibility' },
  { id: 'guard-duty-roles', label: 'Guard Duty Roles' },
  { id: 'absence-defaults', label: 'Absence Defaults' },
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
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="mb-6 text-[34px] font-semibold leading-tight tracking-[-0.374px] text-ink">Settings</h1>
      {settingsLoading || holidaysLoading || !settings ? (
        <p role="status" className="py-8 text-center text-sm text-ink-60">Loading...</p>
      ) : (
        <>
          <div role="tablist" aria-label="Settings sections" className="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4">
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`h-9 shrink-0 whitespace-nowrap rounded-pill px-4 text-sm ${activeTab === tab.id
                  ? 'bg-white font-semibold text-ink ring-1 ring-black/[0.08]'
                  : 'text-ink-80 hover:text-ink'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="rounded-card border border-hairline bg-white p-6">
            {activeTab === 'duty-weights' && <DutyWeightsSection company={company} settings={settings} />}
            {activeTab === 'parade-times' && <ParadeTimesSection company={company} settings={settings} />}
            {activeTab === 'eligibility' && <EligibilitySection company={company} settings={settings} />}
            {activeTab === 'guard-duty-roles' && <GuardDutyRolesSection company={company} settings={settings} />}
            {activeTab === 'absence-defaults' && <AbsenceDefaultsSection company={company} settings={settings} />}
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
