'use client'

import { useState } from 'react'
import { Button } from '@/frontend/components/ui/button'
import { SectionTitle } from '@/frontend/components/ui/layout'

/** A generated message with a copy button. */
export default function MessageBox({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false)

  /** Copies the message to the clipboard. */
  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <SectionTitle className="mb-0">{title}</SectionTitle>
        <Button size="sm" onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
      </div>
      <pre className="bg-parchment border border-hairline rounded-card p-3 text-xs whitespace-pre-wrap font-mono">{text}</pre>
    </div>
  )
}
