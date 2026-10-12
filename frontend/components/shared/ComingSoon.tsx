import Link from 'next/link'
import { PRIMARY_COMPANY, companyLabel } from '@/shared/companies'
import type { Company } from '@/shared/companies'

/** Placeholder page for a company that is not live yet. */
export default function ComingSoon({ company }: { company: Company }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-parchment px-4 text-center">
      <h1 className="text-[34px] font-semibold tracking-[-0.374px] text-ink">{companyLabel(company)} Company</h1>
      <p className="mt-2 text-[17px] text-ink-80">Not available yet.</p>
      <Link href="/" className="mt-6 text-action">Go to {companyLabel(PRIMARY_COMPANY)} Company</Link>
    </main>
  )
}
