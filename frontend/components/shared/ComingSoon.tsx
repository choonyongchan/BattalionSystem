import Link from 'next/link'
import { PRIMARY_COMPANY, companyLabel } from '@/shared/companies'
import type { Company } from '@/shared/companies'

/** Placeholder page for a company that is not live yet. */
export default function ComingSoon({ company }: { company: Company }) {
  return (
    <main className="sar-stripes flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <div className="rounded-card bg-white px-8 py-8 shadow-sm">
        <h1 className="text-2xl font-bold text-ink">{companyLabel(company)} Company</h1>
        <p className="mt-1 text-sm text-ink-60">Not available yet.</p>
        <Link href="/" className="mt-5 inline-flex min-h-11 items-center font-medium text-ink underline">
          Go to {companyLabel(PRIMARY_COMPANY)} Company
        </Link>
      </div>
    </main>
  )
}
