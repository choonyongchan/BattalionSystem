import Link from 'next/link'
import type { ReactNode } from 'react'

/** The 40SAR header: amber with the three red stripes, page title left and actions right. */
export default function GlobalNav({ title, href, children }: { title: string; href: string; children?: ReactNode }) {
  return (
    <nav aria-label="Global" className="sar-stripes sticky top-0 z-30 pt-[env(safe-area-inset-top)] text-sand-ink">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:px-6">
        <Link href={href} className="text-base font-bold tracking-wide">{title}</Link>
        <div className="ml-auto flex items-center gap-1 text-sm font-medium">{children}</div>
      </div>
    </nav>
  )
}
