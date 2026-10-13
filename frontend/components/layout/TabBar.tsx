'use client'

import { Fragment, useRef, useState, type KeyboardEvent } from 'react'
import { CalendarDays, ClipboardList, Ellipsis, Flag, LayoutGrid, Stethoscope, Trophy, Users, type LucideIcon } from 'lucide-react'
import { Dialog } from '@/frontend/components/ui/dialog'

export type TabId = 'overview' | 'parade-state' | 'report-sick' | 'nominal-roll' | 'off-leave' | 'dashboard' | 'conducts'

type Tab = { id: TabId; label: string; icon: LucideIcon }

/** Tabs grouped by workflow: what a commander does daily, people admin, then planning. */
const TAB_GROUPS: { name: string; tabs: Tab[] }[] = [
  { name: 'Daily', tabs: [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'parade-state', label: 'Parade State', icon: ClipboardList },
    { id: 'report-sick', label: 'Report Sick', icon: Stethoscope },
  ] },
  { name: 'Personnel', tabs: [
    { id: 'nominal-roll', label: 'Nominal Roll', icon: Users },
    { id: 'off-leave', label: 'Off/Leave', icon: CalendarDays },
  ] },
  { name: 'Duty & training', tabs: [
    { id: 'dashboard', label: 'Duty Dashboard', icon: Trophy },
    { id: 'conducts', label: 'Conducts', icon: Flag },
  ] },
]

const ALL_TABS = TAB_GROUPS.flatMap((g) => g.tabs)

/** Phone bottom bar: the most used tabs; the rest sit under More (bottom nav holds 5 at most). */
const BOTTOM_IDS: TabId[] = ['overview', 'parade-state', 'report-sick', 'conducts']
const BOTTOM = ALL_TABS.filter((t) => BOTTOM_IDS.includes(t.id))
const MORE = ALL_TABS.filter((t) => !BOTTOM_IDS.includes(t.id))

/** True when `id` names a tab, e.g. from a ?tab= query value. */
export const isTabId = (id: string | null): id is TabId => ALL_TABS.some((t) => t.id === id)

/**
 * Workspace navigation. Tablet and up: a sticky tab bar under the header, with arrow keys,
 * Home and End moving between tabs (WAI-ARIA tabs pattern). Phones: a bottom tab bar in
 * thumb reach, with a More sheet for the less used tabs.
 */
export default function TabBar({ active, onSelect }: { active: TabId; onSelect: (id: TabId) => void }) {
  const refs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({})
  const [moreOpen, setMoreOpen] = useState(false)

  /** Moves selection and focus with the keyboard. */
  function onKeyDown(e: KeyboardEvent) {
    const i = ALL_TABS.findIndex((t) => t.id === active)
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: ALL_TABS.length - 1 }[e.key]
    if (next === undefined) return
    e.preventDefault()
    const id = ALL_TABS[(next + ALL_TABS.length) % ALL_TABS.length].id
    onSelect(id)
    refs.current[id]?.focus()
  }

  /** Picks a tab from the phone bar or sheet and closes the sheet. */
  function pick(id: TabId) {
    setMoreOpen(false)
    onSelect(id)
    window.scrollTo({ top: 0 })
  }

  const moreActive = MORE.some((t) => t.id === active)

  return (
    <>
      <div className="sticky top-14 z-20 hidden border-b border-hairline bg-pearl/90 backdrop-blur md:block">
        <div
          role="tablist"
          aria-label="Workspace"
          onKeyDown={onKeyDown}
          className="mx-auto flex h-12 max-w-screen-2xl items-center gap-1 overflow-x-auto px-6"
        >
          {TAB_GROUPS.map((g, gi) => (
            <Fragment key={g.name}>
              {gi > 0 && <span aria-hidden className="mx-2 h-5 w-px shrink-0 bg-hairline" />}
              <span aria-hidden className="mr-1 shrink-0 text-xs text-ink-60">{g.name}</span>
              {g.tabs.map((t) => {
                const selected = t.id === active
                return (
                  <button
                    key={t.id}
                    ref={(el) => { refs.current[t.id] = el }}
                    role="tab"
                    id={`tab-${t.id}`}
                    aria-selected={selected}
                    aria-controls="workspace-panel"
                    tabIndex={selected ? 0 : -1}
                    onClick={() => onSelect(t.id)}
                    className={`h-12 shrink-0 whitespace-nowrap border-b-2 px-3 text-sm font-medium ${selected
                      ? 'border-action text-ink'
                      : 'border-transparent text-ink-60 hover:border-hairline hover:text-ink-80'}`}
                  >
                    {t.label}
                  </button>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {moreOpen && (
        <Dialog placement="bottom" onClose={() => setMoreOpen(false)} aria-label="More tabs">
          <ul className="px-2 pt-2 pb-4">
            {MORE.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => pick(t.id)}
                  aria-current={t.id === active ? 'page' : undefined}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-4 text-left text-base ${t.id === active ? 'bg-parchment font-semibold text-ink' : 'text-ink-80'}`}
                >
                  <t.icon className="size-5" aria-hidden />
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </Dialog>
      )}

      <nav
        aria-label="Workspace tabs"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-hairline bg-pearl/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="grid h-16 grid-cols-5">
          {[...BOTTOM, { id: 'more' as const, label: 'More', icon: Ellipsis }].map((t) => {
            const isMore = t.id === 'more'
            const current = isMore ? moreActive || moreOpen : t.id === active
            return (
              <button
                key={t.id}
                onClick={() => (isMore ? setMoreOpen(!moreOpen) : pick(t.id as TabId))}
                aria-current={!isMore && current ? 'page' : undefined}
                aria-expanded={isMore ? moreOpen : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${current ? 'text-ink' : 'text-ink-60'}`}
              >
                <t.icon className={`size-6 ${current ? 'stroke-[2.25]' : ''}`} aria-hidden />
                {t.label}
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
