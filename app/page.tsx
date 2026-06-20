import Link from 'next/link'
import { COMPANIES, COMPANY_THEMES, companyLabel } from '@/lib/companies'

export default function HomePage() {
  return (
    <main className="relative min-h-screen bg-yellow-50 flex flex-col items-center justify-center px-5 py-14 overflow-hidden">
      {/* Three vertical pastel red stripes — 40SAR motif */}
      <div className="absolute inset-y-0 left-[16%] w-[5%] bg-red-300/50 pointer-events-none" />
      <div className="absolute inset-y-0 left-[47%] w-[5%] bg-red-300/50 pointer-events-none" />
      <div className="absolute inset-y-0 left-[78%] w-[5%] bg-red-300/50 pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm sm:max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-yellow-900 tracking-tight">40 SAR</h1>
          <p className="text-yellow-700/70 text-xs tracking-widest uppercase mt-2">Battalion System</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {COMPANIES.map((company) => {
            const theme = COMPANY_THEMES[company]
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
