'use client'

import { Fragment, useRef, type KeyboardEvent } from 'react'

export type TabId = 'parade-state' | 'rsi' | 'nominal-roll' | 'off-leave' | 'dashboard' | 'conducts'

/** Tabs grouped by workflow: what a commander does daily, people admin, then planning. */
export const TAB_GROUPS: { name: string; tabs: { id: TabId; label: string }[] }[] = [
  { name: 'Daily', tabs: [{ id: 'parade-state', label: 'Parade State' }, { id: 'rsi', label: 'RSI' }] },
  { name: 'Personnel', tabs: [{ id: 'nominal-roll', label: 'Nominal Roll' }, { id: 'off-leave', label: 'Off/Leave' }] },
  { name: 'Duty & training', tabs: [{ id: 'dashboard', label: 'Duty Dashboard' }, { id: 'conducts', label: 'Conducts' }] },
]

const ALL_TABS = TAB_GROUPS.flatMap((g) => g.tabs)

/** True when `id` names a tab, e.g. from a ?tab= query value. */
export const isTabId = (id: string | null): id is TabId => ALL_TABS.some((t) => t.id === id)

/**
 * DESIGN.md frosted sub-nav holding the workspace tabs. Arrow keys, Home and End move
 * between tabs (WAI-ARIA tabs pattern); the group names show from tablet width up.
 */
export default function TabBar({ active, onSelect }: { active: TabId; onSelect: (id: TabId) => void }) {
  const refs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({})

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

  return (
    <div className="sticky top-11 z-20 border-b border-black/[0.08] bg-parchment/80 backdrop-blur-xl backdrop-saturate-[1.8]">
      <div
        role="tablist"
        aria-label="Workspace"
        onKeyDown={onKeyDown}
        className="mx-auto flex h-[52px] max-w-screen-2xl items-center gap-1 overflow-x-auto px-4 sm:px-6"
      >
        {TAB_GROUPS.map((g, gi) => (
          <Fragment key={g.name}>
            {gi > 0 && <span aria-hidden className="mx-2 h-5 w-px shrink-0 bg-hairline" />}
            <span aria-hidden className="mr-1 hidden shrink-0 text-xs text-ink-60 md:inline">{g.name}</span>
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
                  className={`h-9 shrink-0 whitespace-nowrap rounded-pill px-4 text-sm ${selected
                    ? 'bg-white font-semibold text-ink ring-1 ring-black/[0.08]'
                    : 'text-ink-80 hover:text-ink'}`}
                >
                  {t.label}
                </button>
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
