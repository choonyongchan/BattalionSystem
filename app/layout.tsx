import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { QueryProvider } from '@/frontend/providers/query-client'
import { Toaster } from 'sonner'
import './globals.css'

// SF Pro on Apple devices via system-ui; Inter is the closest open substitute elsewhere
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: 'Hercules Company · 40SAR',
  description: '40th Singapore Armoured Regiment',
  appleWebApp: { capable: true, title: '40SAR', statusBarStyle: 'default' },
}

// Edge to edge on phones (content pads itself with the safe-area insets); the status bar takes the header's amber
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fef3c7',
  // Light only: OS dark mode and browser forced-dark must not flip the page or its native controls
  colorScheme: 'only light',
}

/** Root HTML shell: React Query provider, toasts and Vercel analytics. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans text-ink antialiased">
        <QueryProvider>
          {children}
          <Toaster position="top-center" />
        </QueryProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
