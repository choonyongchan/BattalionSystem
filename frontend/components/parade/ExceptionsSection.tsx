'use client'

import { useState } from 'react'
import type { AppSettings } from '@/backend/domain/settings/settings'
import { matchesExceptionQuery, sortExceptions } from '@/backend/domain/parade/exception-table'
import type { ParadeData } from '@/frontend/hooks/useParadeData'
import AddExceptionForm from './AddExceptionForm'
import ExceptionsTable from './ExceptionsTable'
import { Button } from '@/frontend/components/ui/button'
import { SearchInput } from '@/frontend/components/ui/fields'
import { Empty } from '@/frontend/components/ui/layout'

/** Searchable list of exceptions with an add form. */
export default function ExceptionsSection({ date, settings, data }: {
  date: string
  settings: AppSettings | undefined
  data: ParadeData
}) {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const rows = sortExceptions(data.exceptions)
    .filter((e) => matchesExceptionQuery(e, search, data.soldiers))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <SearchInput
          placeholder="Search by name, scope, reason, 4D..."
          aria-label="Search exceptions"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant={showForm ? 'secondary' : 'primary'} className="shrink-0" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Exception'}
        </Button>
      </div>

      {/* Remounts on open, so the form resets to the currently viewed date */}
      {showForm && <AddExceptionForm date={date} settings={settings} data={data} onDone={() => setShowForm(false)} />}

      {rows.length === 0 ? (
        <Empty>{search.trim() ? 'No exceptions match that query.' : 'No exceptions for this date.'}</Empty>
      ) : (
        <ExceptionsTable settings={settings} data={data} rows={rows} />
      )}
    </div>
  )
}
