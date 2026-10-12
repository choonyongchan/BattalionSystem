import Link from 'next/link'
import type { ReactNode } from 'react'

/** DESIGN.md global nav: a slim black bar with the page title left and actions right. */
export default function GlobalNav({ title, href, children }: { title: string; href: string; children?: ReactNode }) {
  return (
    <nav aria-label="Global" className="sticky top-0 z-30 h-11 bg-black text-white">
      <div className="mx-auto flex h-full max-w-screen-2xl items-center gap-5 px-4 text-xs tracking-[-0.12px] sm:px-6">
        <Link href={href} className="font-semibold text-white/90 hover:text-white">{title}</Link>
        <div className="ml-auto flex items-center gap-1">{children}</div>
      </div>
    </nav>
  )
}
