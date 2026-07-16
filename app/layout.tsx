import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { QueryProvider } from '@/lib/query-client'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'Battalion System',
  description: '40th Singapore Armoured Regiment',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="text-gray-900 min-h-screen antialiased">
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
