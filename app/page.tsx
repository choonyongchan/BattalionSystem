import Link from 'next/link'
import { COMPANIES, COMPANY_LABELS } from '@/lib/companies'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="text-center mb-14">
        <h1 className="text-4xl font-bold text-green-800 tracking-tight mb-2">
          Good Day, Commander
        </h1>
        <p className="text-gray-500 text-sm uppercase tracking-widest">Battalion Management System</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full max-w-4xl">
        {COMPANIES.map((company) => (
          <Link
            key={company}
            href={`/${company}`}
            className="flex flex-col items-center justify-center p-8 bg-white border-2 border-green-700 rounded-xl shadow-sm hover:bg-green-700 hover:text-white transition-all group"
          >
            <span className="text-xl font-bold text-green-800 group-hover:text-white">
              {COMPANY_LABELS[company]}
            </span>
            <span className="text-xs text-gray-400 group-hover:text-green-200 mt-1 uppercase tracking-wide">
              Company
            </span>
          </Link>
        ))}
      </div>
    </main>
  )
}
