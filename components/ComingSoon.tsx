import { companyLabel } from '@/lib/companies'
import type { Company } from '@/lib/companies'

export default function ComingSoon({ company }: { company: Company }) {
  return (
    <main className="min-h-screen bg-amber-100 flex items-center justify-center">
      <div className="text-center">
        <p className="text-2xl font-bold text-gray-800 mb-1">Coming Soon</p>
        <p className="text-sm text-gray-400">{companyLabel(company)} Company is not yet available.</p>
      </div>
    </main>
  )
}
