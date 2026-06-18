'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Company } from '@/lib/companies'
import { COMPANY_THEMES } from '@/lib/companies'
import NominalRoll from './NominalRoll'
import ParadeState from './ParadeState'

type Tab = 'nominal-roll' | 'parade-state'

const TABS: { id: Tab; label: string }[] = [
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
  const [activeTab, setActiveTab] = useState<Tab>('nominal-roll')
  const theme = COMPANY_THEMES[company]

  return (
    <div className="min-h-screen flex flex-col">
      <nav className={`${theme.navBg} text-white px-6 py-4 flex items-center gap-4 shadow`}>
        <Link href="/" className={`${theme.navLinkText} text-sm transition-colors`}>
          ← Home
        </Link>
        <span className={theme.navDivider}>|</span>
        <h1 className="font-bold tracking-wide">{label} Company</h1>
      </nav>

      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-5xl mx-auto flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? `${theme.tabActiveBorder} ${theme.tabActiveText}`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {activeTab === 'nominal-roll' ? (
          <NominalRoll company={company} />
        ) : (
          <ParadeState company={company} companyLabel={label} />
        )}
      </div>
    </div>
  )
}
