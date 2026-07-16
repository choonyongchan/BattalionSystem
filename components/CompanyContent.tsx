'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Company } from '@/lib/companies'
import { COMPANY_THEMES } from '@/lib/companies'
import { useAuth } from '@/lib/useAuth'
import NominalRoll from './NominalRoll'
import ParadeState from './ParadeState'
import DutyDashboard from './DutyDashboard'
import CommanderLoginForm from './CommanderLoginForm'

type Tab = 'dashboard' | 'nominal-roll' | 'parade-state'

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'nominal-roll', label: 'Nominal Roll' },
  { id: 'parade-state', label: 'Parade State' },
]

export default function CompanyContent({
  company,
  label,
}: {
  company: Company
  label: string
}) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const theme = COMPANY_THEMES[company]
  const { isCommander, loading: authLoading, signIn, signOut } = useAuth(company)

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <nav className="sticky top-0 z-20 bg-amber-100 px-4 py-3 flex items-center gap-3 shadow-sm relative overflow-hidden">
        <div className="absolute inset-y-0 left-[34%] w-[7%] min-w-7 bg-red-300/50 pointer-events-none" />
        <div className="absolute inset-y-0 left-[42%] w-[16%] min-w-16 bg-red-300/50 pointer-events-none" />
        <div className="absolute inset-y-0 left-[59%] w-[7%] min-w-7 bg-red-300/50 pointer-events-none" />
        <Link href="/" className="text-yellow-800 hover:text-yellow-600 text-sm font-medium transition-colors relative z-10">
          ←
        </Link>
        <span className="text-yellow-500 relative z-10">|</span>
        <h1 className="font-bold text-sm tracking-wide text-yellow-900 relative z-10">{label} Coy</h1>
        {/* NOTE: this nav header is duplicated between CompanyContent.tsx and DutyDashboard.tsx's
            standalone route nav — known follow-up, not addressed here. */}
        <div className="ml-auto flex items-center gap-3 relative z-10">
          {!authLoading && isCommander && (
            <>
              <Link href={`/${company}/settings`} title="Settings" className="text-yellow-700 hover:text-yellow-900 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
              <button
                onClick={signOut}
                className="text-xs text-yellow-700 hover:text-yellow-900 font-medium transition-colors"
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      </nav>

      <div className="bg-white border-b border-gray-200">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${
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

      <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-6">
        {authLoading ? (
          <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>
        ) : !isCommander ? (
          <CommanderLoginForm companyLabel={label} onSignIn={signIn} />
        ) : activeTab === 'dashboard' ? (
          <DutyDashboard company={company} label={label} embedded />
        ) : activeTab === 'nominal-roll' ? (
          <NominalRoll company={company} />
        ) : (
          <ParadeState company={company} companyLabel={label} />
        )}
      </div>
    </div>
  )
}
