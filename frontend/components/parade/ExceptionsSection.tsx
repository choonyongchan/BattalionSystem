'use client'

import { useState } from 'react'
import type { AppSettings } from '@/backend/domain/settings/settings'
import { matchesExceptionQuery, sortExceptions } from '@/backend/domain/parade/exception-table'
import type { ParadeData } from '@/frontend/hooks/useParadeData'
import AddExceptionForm from './AddExceptionForm'
import ExceptionsTable from './ExceptionsTable'
import { THEME } from '@/frontend/theme'

/** Searchable list of exceptions (Guard Duty excluded) with an add form. */
export default function ExceptionsSection({ date, settings, data }: {
  date: string
  settings: AppSettings | undefined
  data: ParadeData
}) {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const rows = sortExceptions(data.exceptions)
    .filter((e) => e.scope !== 'Guard Duty' && matchesExceptionQuery(e, search, data.soldiers))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <input
          type="search"
          placeholder="Search by name, scope, reason, 4D..."
          aria-label="Search exceptions"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-hairline rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-action-focus bg-white"
        />
        <button
          onClick={() => setShowForm(!showForm)}
          className={`flex-shrink-0 px-4 py-3 ${THEME.buttonBg} ${THEME.buttonHoverBg} text-white text-sm font-medium rounded-lg transition-colors`}
        >
          {showForm ? 'Cancel' : '+ Exception'}
        </button>
      </div>

      {/* Remounts on open, so the form resets to the currently viewed date */}
      {showForm && <AddExceptionForm date={date} settings={settings} data={data} onDone={() => setShowForm(false)} />}

      {rows.length === 0 ? (
        <div className="text-center py-12 text-ink-60 text-sm">
          {search.trim() ? 'No exceptions match that query.' : 'No exceptions for this date.'}
        </div>
      ) : (
        <ExceptionsTable settings={settings} data={data} rows={rows} />
      )}
    </div>
  )
}
