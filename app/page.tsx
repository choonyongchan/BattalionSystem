'use client'

import Link from 'next/link'
import { useState } from 'react'
import { COMPANIES, COMPANY_THEMES, DISABLED_COMPANIES, companyLabel } from '@/lib/companies'

export default function HomePage() {
  const [showComingSoon, setShowComingSoon] = useState(false)

  return (
    <main className="relative min-h-screen bg-yellow-50 flex flex-col items-center justify-center px-5 py-14 overflow-hidden">
      {/* Three vertical pastel red stripes — 40SAR motif */}
      <div className="absolute inset-y-0 left-[16%] w-[5%] bg-red-300/50 pointer-events-none" />
      <div className="absolute inset-y-0 left-[47%] w-[5%] bg-red-300/50 pointer-events-none" />
      <div className="absolute inset-y-0 left-[78%] w-[5%] bg-red-300/50 pointer-events-none" />

      {showComingSoon && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setShowComingSoon(false)}
        >
          <div className="bg-white rounded-2xl shadow-xl px-10 py-8 text-center max-w-xs mx-4">
            <p className="text-2xl font-bold text-gray-800 mb-1">Coming Soon</p>
            <p className="text-sm text-gray-400">This company is not yet available.</p>
          </div>
        </div>
      )}

      <div className="relative z-10 w-full max-w-sm sm:max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-yellow-900 tracking-tight">Battalion System</h1>
          <p className="text-yellow-700/70 text-xs tracking-widest uppercase mt-2">40th Singapore Armoured Regiment</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {COMPANIES.map((company) => {
            const theme = COMPANY_THEMES[company]
            const disabled = DISABLED_COMPANIES.has(company)

            if (disabled) {
              return (
                <button
                  key={company}
                  onClick={() => setShowComingSoon(true)}
                  className={`flex items-center justify-center py-8 bg-white border-2 ${theme.cardBorder} rounded-2xl shadow-sm opacity-50 cursor-not-allowed`}
                >
                  <span className={`text-base font-bold ${theme.cardText}`}>
                    {companyLabel(company)}
                  </span>
                </button>
              )
            }

            return (
              <Link
                key={company}
                href={`/${company}`}
                className={`flex items-center justify-center py-8 bg-white border-2 ${theme.cardBorder} rounded-2xl shadow-sm ${theme.cardHoverBg} hover:border-transparent transition-all group`}
              >
                <span className={`text-base font-bold ${theme.cardText} group-hover:text-white`}>
                  {companyLabel(company)}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}
