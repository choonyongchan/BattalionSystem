'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Company } from '@/lib/companies'
import { COMPANY_THEMES } from '@/lib/companies'
import { useAuth } from '@/hooks/useAuth'
import { useSettingsQuery, usePublicHolidaysQuery } from '@/lib/settings'
import CommanderLoginForm from '../auth/CommanderLoginForm'
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

export default function SettingsPage({ company, label }: { company: Company; label: string }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('duty-weights')
  const theme = COMPANY_THEMES[company]
  const { isCommander, loading: authLoading, signIn, signOut } = useAuth(company)
  const { data: settings, isLoading: settingsLoading } = useSettingsQuery(company)
  const { data: publicHolidays, isLoading: holidaysLoading } = usePublicHolidaysQuery()

  const content = (settingsLoading || holidaysLoading || !settings) ? (
    <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>
  ) : (
    <div>
      <div className="bg-white border-b border-gray-200 -mx-4 px-4 sm:mx-0 sm:px-0 mb-4 overflow-x-auto">
        <div className="flex min-w-max sm:min-w-0">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? `${theme.activeBorder} ${theme.activeText}`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
        {activeTab === 'duty-weights' && <DutyWeightsSection company={company} settings={settings} />}
        {activeTab === 'parade-times' && <ParadeTimesSection company={company} settings={settings} />}
        {activeTab === 'eligibility' && <EligibilitySection company={company} settings={settings} />}
        {activeTab === 'guard-duty-roles' && <GuardDutyRolesSection company={company} settings={settings} />}
        {activeTab === 'absence-defaults' && <AbsenceDefaultsSection company={company} settings={settings} />}
        {activeTab === 'public-holidays' && (
          <div>
            <p className="text-xs text-gray-400 mb-3">Shared across all companies</p>
            <PublicHolidaysSection publicHolidays={publicHolidays ?? []} />
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <nav className="sticky top-0 z-20 bg-amber-100 px-4 py-3 flex items-center gap-3 shadow-sm relative overflow-hidden">
        <div className="absolute inset-y-0 left-[34%] w-[7%] min-w-7 bg-red-300/50 pointer-events-none" />
        <div className="absolute inset-y-0 left-[42%] w-[16%] min-w-16 bg-red-300/50 pointer-events-none" />
        <div className="absolute inset-y-0 left-[59%] w-[7%] min-w-7 bg-red-300/50 pointer-events-none" />
        <Link href={`/${company}`} className="text-yellow-800 hover:text-yellow-600 text-sm font-medium transition-colors relative z-10">
          ← {label} Coy
        </Link>
        <span className="text-yellow-500 relative z-10">|</span>
        <h1 className="font-bold text-sm tracking-wide text-yellow-900 relative z-10">Settings</h1>
        {!authLoading && isCommander && (
          <div className="ml-auto relative z-10">
            <button onClick={signOut} className="text-xs text-yellow-700 hover:text-yellow-900 font-medium transition-colors">
              Sign Out
            </button>
          </div>
        )}
      </nav>

      <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-6">
        {authLoading ? (
          <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>
        ) : !isCommander ? (
          <CommanderLoginForm companyLabel={label} onSignIn={signIn} />
        ) : content}
      </div>
    </div>
  )
}
