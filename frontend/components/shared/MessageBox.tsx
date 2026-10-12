'use client'

import { useState } from 'react'

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
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <button onClick={copy} className="px-3 py-1.5 text-xs bg-ink text-white rounded-lg">{copied ? 'Copied' : 'Copy'}</button>
      </div>
      <pre className="bg-parchment border border-hairline rounded-lg p-3 text-xs whitespace-pre-wrap font-mono">{text}</pre>
    </div>
  )
}
