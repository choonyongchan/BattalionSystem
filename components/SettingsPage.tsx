'use client'

import Link from 'next/link'
import type { Company } from '@/lib/companies'
import { useAuth } from '@/lib/useAuth'
import { useSettingsQuery, usePublicHolidaysQuery } from '@/lib/settings'
import CommanderLoginForm from './CommanderLoginForm'
import DutyWeightsSection from './settings/DutyWeightsSection'
import ParadeTimesSection from './settings/ParadeTimesSection'
import EligibilitySection from './settings/EligibilitySection'
import AbsenceDefaultsSection from './settings/AbsenceDefaultsSection'
import PublicHolidaysSection from './settings/PublicHolidaysSection'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'

export default function SettingsPage({ company, label }: { company: Company; label: string }) {
  const { isCommander, loading: authLoading, signIn, signOut } = useAuth(company)
  const { data: settings, isLoading: settingsLoading } = useSettingsQuery(company)
  const { data: publicHolidays, isLoading: holidaysLoading } = usePublicHolidaysQuery()

  const content = (settingsLoading || holidaysLoading || !settings) ? (
    <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>
  ) : (
    <Accordion defaultValue={['duty-weights']} className="space-y-3">
      <AccordionItem value="duty-weights" className="bg-white border border-gray-200 rounded-2xl px-4">
        <AccordionTrigger>Duty Weights</AccordionTrigger>
        <AccordionContent><DutyWeightsSection company={company} settings={settings} /></AccordionContent>
      </AccordionItem>
      <AccordionItem value="parade-times" className="bg-white border border-gray-200 rounded-2xl px-4">
        <AccordionTrigger>Parade Times</AccordionTrigger>
        <AccordionContent><ParadeTimesSection company={company} settings={settings} /></AccordionContent>
      </AccordionItem>
      <AccordionItem value="eligibility" className="bg-white border border-gray-200 rounded-2xl px-4">
        <AccordionTrigger>Duty Eligibility Overrides</AccordionTrigger>
        <AccordionContent><EligibilitySection company={company} settings={settings} /></AccordionContent>
      </AccordionItem>
      <AccordionItem value="absence-defaults" className="bg-white border border-gray-200 rounded-2xl px-4">
        <AccordionTrigger>Absence Scope Defaults</AccordionTrigger>
        <AccordionContent><AbsenceDefaultsSection company={company} settings={settings} /></AccordionContent>
      </AccordionItem>
      <AccordionItem value="public-holidays" className="bg-white border border-gray-200 rounded-2xl px-4">
        <AccordionTrigger>
          Public Holidays <span className="ml-2 text-xs font-normal text-gray-400">(shared across all companies)</span>
        </AccordionTrigger>
        <AccordionContent><PublicHolidaysSection publicHolidays={publicHolidays ?? []} /></AccordionContent>
      </AccordionItem>
    </Accordion>
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
