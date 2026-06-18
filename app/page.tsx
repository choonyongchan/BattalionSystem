import Link from 'next/link'
import { COMPANIES, COMPANY_LABELS, COMPANY_THEMES } from '@/lib/companies'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold text-yellow-700 tracking-tight mb-2">
          Good Day, Commander
        </h1>
        <p className="text-gray-500 text-sm uppercase tracking-widest">Battalion Management System</p>
      </div>

      <div className="flex gap-1 mb-10" aria-hidden="true">
        <div className="w-1.5 h-10 bg-red-600 rounded-sm" />
        <div className="w-1.5 h-10 bg-red-600 rounded-sm" />
        <div className="w-1.5 h-10 bg-red-600 rounded-sm" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full max-w-4xl">
        {COMPANIES.map((company) => {
          const theme = COMPANY_THEMES[company]
          return (
            <Link
              key={company}
              href={`/${company}`}
              className={`flex flex-col items-center justify-center p-8 bg-white border-2 ${theme.cardBorder} rounded-xl shadow-sm ${theme.cardHoverBg} hover:text-white transition-all group`}
            >
              <span className={`text-xl font-bold ${theme.cardText} group-hover:text-white`}>
                {COMPANY_LABELS[company]}
              </span>
              <span className={`text-xs text-gray-400 ${theme.cardHoverSubText} mt-1 uppercase tracking-wide`}>
                Company
              </span>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
