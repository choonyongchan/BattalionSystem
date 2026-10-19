'use client'

import { useState } from 'react'
import type { Company } from '@/shared/companies'
import { useSettingsQuery, usePublicHolidaysQuery } from '@/frontend/hooks/queries'
import CompanyShell from '@/frontend/components/layout/CompanyShell'
import { Card, Loading } from '@/frontend/components/ui/layout'
import { Segmented } from '@/frontend/components/ui/segmented'
import DutyWeightsSection from './DutyWeightsSection'
import ParadeTimesSection from './ParadeTimesSection'
import EligibilitySection from './EligibilitySection'
import GuardDutyRolesSection from './GuardDutyRolesSection'
import AbsenceDefaultsSection from './AbsenceDefaultsSection'
import PublicHolidaysSection from './PublicHolidaysSection'
import { ConductsSection, DutyRosterSection, InOutSection, OverviewSection, PlatoonsSection, ReportSickSection } from './CompanySections'

type SettingsTab =
  | 'platoons' | 'duty-roster' | 'duty-weights' | 'parade-times' | 'eligibility' | 'guard-duty-roles'
  | 'absence-defaults' | 'report-sick' | 'conducts' | 'overview' | 'public-holidays'

const SETTINGS_TABS: { value: SettingsTab; label: string }[] = [
  { value: 'platoons', label: 'Platoons' },
  { value: 'duty-roster', label: 'Duty Roster' },
  { value: 'duty-weights', label: 'Duty Weights' },
  { value: 'parade-times', label: 'Parade Times' },
  { value: 'eligibility', label: 'Duty Eligibility' },
  { value: 'guard-duty-roles', label: 'Guard Duty Roles' },
  { value: 'absence-defaults', label: 'Absence Defaults' },
  { value: 'report-sick', label: 'Report Sick' },
  { value: 'conducts', label: 'Conducts' },
  { value: 'overview', label: 'Overview' },
  { value: 'public-holidays', label: 'Public Holidays' },
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
        <Loading />
      ) : (
        <>
          <Segmented aria-label="Settings sections" className="mb-4" value={activeTab} onChange={setActiveTab} options={SETTINGS_TABS} />

          <Card className="p-4 md:p-6">
            {activeTab === 'platoons' && <PlatoonsSection company={company} settings={settings} />}
            {activeTab === 'duty-roster' && <DutyRosterSection company={company} settings={settings} />}
            {activeTab === 'duty-weights' && <DutyWeightsSection company={company} settings={settings} />}
            {activeTab === 'parade-times' && <ParadeTimesSection company={company} settings={settings} />}
            {activeTab === 'eligibility' && <EligibilitySection company={company} settings={settings} />}
            {activeTab === 'guard-duty-roles' && <GuardDutyRolesSection company={company} settings={settings} />}
            {activeTab === 'absence-defaults' && (
              <>
                <AbsenceDefaultsSection company={company} settings={settings} />
                <InOutSection company={company} settings={settings} />
              </>
            )}
            {activeTab === 'report-sick' && <ReportSickSection company={company} settings={settings} />}
            {activeTab === 'conducts' && <ConductsSection company={company} settings={settings} />}
            {activeTab === 'overview' && <OverviewSection company={company} settings={settings} />}
            {activeTab === 'public-holidays' && (
              <div>
                <p className="mb-3 text-sm text-ink-60">Shared across all companies</p>
                <PublicHolidaysSection publicHolidays={publicHolidays ?? []} />
              </div>
            )}
          </Card>
        </>
      )}
    </main>
  )
}
