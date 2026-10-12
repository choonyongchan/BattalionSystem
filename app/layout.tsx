import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { QueryProvider } from '@/frontend/providers/query-client'
import { Toaster } from 'sonner'
import './globals.css'

// SF Pro on Apple devices via system-ui; Inter is the closest open substitute elsewhere (DESIGN.md)
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: 'Hercules Company · 40SAR',
  description: '40th Singapore Armoured Regiment',
}

/** Root HTML shell: React Query provider, toasts and Vercel analytics. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans text-ink antialiased">
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
