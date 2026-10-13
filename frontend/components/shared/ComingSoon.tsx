import Link from 'next/link'
import { PRIMARY_COMPANY, companyLabel } from '@/shared/companies'
import type { Company } from '@/shared/companies'
import { buttonClass } from '@/frontend/components/ui/button'
import { Card } from '@/frontend/components/ui/layout'

/** Placeholder page for a company that is not live yet. */
export default function ComingSoon({ company }: { company: Company }) {
  return (
    <main className="sar-stripes flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <Card className="p-8">
        <h1 className="text-2xl font-bold text-ink">{companyLabel(company)} Company</h1>
        <p className="mt-1 text-sm text-ink-60">Not available yet.</p>
        <Link href="/" className={`${buttonClass()} mt-5`}>
          Go to {companyLabel(PRIMARY_COMPANY)} Company
        </Link>
      </Card>
    </main>
  )
}
