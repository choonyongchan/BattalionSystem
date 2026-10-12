'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Client-side redirect for the static export (no server redirects); links as a fallback. */
export default function Redirect({ to }: { to: string }) {
  const router = useRouter()
  useEffect(() => router.replace(to), [router, to])
  return <p className="py-16 text-center text-sm text-ink-60">Moved to <a className="text-action underline" href={to}>{to}</a></p>
}
