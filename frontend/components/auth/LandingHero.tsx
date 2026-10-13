import { Card } from '@/frontend/components/ui/layout'
import CommanderLoginForm from './CommanderLoginForm'

/** Signed-out landing page: the 40SAR stripes behind the company name and the commander sign-in. */
export default function LandingHero({ companyLabel, onSignIn }: {
  companyLabel: string
  onSignIn: (password: string) => Promise<{ message: string } | null>
}) {
  return (
    <main className="sar-stripes flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center px-5 pt-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-sand-ink">{companyLabel} Company</h1>
          <p className="mt-2 text-xs uppercase tracking-widest text-sand-ink/70">40th Singapore Armoured Regiment</p>
        </div>
        <Card className="p-5">
          <CommanderLoginForm companyLabel={companyLabel} onSignIn={onSignIn} />
        </Card>
      </div>
    </main>
  )
}
