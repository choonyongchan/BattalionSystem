import CommanderLoginForm from './CommanderLoginForm'

const AREAS = [
  { name: 'Daily', detail: 'Parade state, duties for the day and report sicks.' },
  { name: 'Personnel', detail: 'Nominal roll, soldier records, off and leave balances.' },
  { name: 'Duty & training', detail: 'Duty points leaderboard and conduct participation.' },
]

/** Signed-out landing page: hero headline with the commander sign-in, then what is inside. */
export default function LandingHero({ companyLabel, onSignIn }: {
  companyLabel: string
  onSignIn: (password: string) => Promise<{ message: string } | null>
}) {
  return (
    <main>
      <section className="bg-white px-4 pt-20 pb-16 text-center sm:pt-28 sm:pb-24">
        <h1 className="text-[34px] font-semibold leading-[1.07] tracking-[-0.28px] text-ink sm:text-[56px]">
          {companyLabel} Company
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[21px] leading-[1.19] text-ink-80 sm:text-[28px] sm:leading-[1.14]">
          The company&apos;s parade state, duties and people, in one place.
        </p>
        <div className="mx-auto mt-10 max-w-sm">
          <CommanderLoginForm companyLabel={companyLabel} onSignIn={onSignIn} />
        </div>
      </section>

      <section aria-label="What is inside" className="bg-tile px-4 py-16 text-white sm:py-20">
        <ul className="mx-auto grid max-w-4xl gap-10 sm:grid-cols-3">
          {AREAS.map((a) => (
            <li key={a.name}>
              <h2 className="text-[21px] font-semibold leading-[1.19]">{a.name}</h2>
              <p className="mt-2 text-[17px] text-[#cccccc]">{a.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="bg-parchment px-4 py-10 text-center text-xs text-ink-60">
        40th Singapore Armoured Regiment
      </footer>
    </main>
  )
}
