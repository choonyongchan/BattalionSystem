'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Settings } from 'lucide-react'
import type { Company } from '@/shared/companies'
import { companyHref } from '@/shared/companies'
import { useAuth } from '@/frontend/hooks/useAuth'
import LandingHero from '@/frontend/components/auth/LandingHero'
import GlobalNav from './GlobalNav'

const NAV_BTN = 'inline-flex h-11 min-w-11 items-center justify-center px-2 text-white/80 hover:text-white'

/**
 * Commander-only page frame: the landing hero while signed out, otherwise the global nav
 * (title, settings, sign out) above `children`.
 */
export default function CompanyShell({ company, label, children }: { company: Company; label: string; children: ReactNode }) {
  const { isCommander, loading, signIn, signOut } = useAuth(company)

  if (loading) {
    return (
      <>
        <GlobalNav title={`${label} Coy`} href={companyHref(company)} />
        <p role="status" className="py-16 text-center text-sm text-ink-60">Loading...</p>
      </>
    )
  }

  if (!isCommander) {
    return (
      <>
        <GlobalNav title="40SAR" href={companyHref(company)} />
        <LandingHero companyLabel={label} onSignIn={signIn} />
      </>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <GlobalNav title={`${label} Coy`} href={companyHref(company)}>
        <Link href={companyHref(company, 'settings')} aria-label="Settings" title="Settings" className={NAV_BTN}>
          <Settings className="size-4" aria-hidden />
        </Link>
        <button onClick={signOut} className={NAV_BTN}>Sign Out</button>
      </GlobalNav>
      {children}
    </div>
  )
}
