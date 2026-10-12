'use client'

import { useMemo, useState } from 'react'
import type { Exception, Soldier } from '@/shared/types'
import type { Company } from '@/shared/companies'
import { todaySGDate } from '@/shared/dates'
import { SoldierRepository } from '@/backend/data/repositories/SoldierRepository'
import { combine, useExceptions, useRefresh, useSettingsQuery, useSoldiers } from '@/frontend/hooks/queries'
import { exceptionSoldierKey, isActiveOn, isOnStrength, soldierIndex, soldierKeyOf } from '@/backend/domain/exceptions/active'
import { filterSoldiers } from '@/backend/domain/nominal-roll/roster'
import SoldierSheet from '@/frontend/components/soldier/SoldierSheet'
import BulkImportModal from './BulkImportModal'
import AddSoldierForm from './AddSoldierForm'
import DeleteAllPanel from './DeleteAllPanel'
import SoldierTables from './SoldierTables'
import { THEME } from '@/frontend/theme'

/** Nominal Roll tab: search, add, bulk import, edit and delete soldiers; opens a soldier's sheet. */
export default function NominalRoll({ company }: { company: Company }) {
  const soldierRepo = useMemo(() => new SoldierRepository(company), [company])
  const soldiersQ = useSoldiers(company)
  const exceptionsQ = useExceptions(company)
  const settingsQ = useSettingsQuery(company)
  const { loading, error: loadError } = combine(soldiersQ, exceptionsQ, settingsQ)
  const [writeError, setError] = useState<string | null>(null)
  const error = writeError ?? loadError
  // Refetch in place: a "Loading..." swap would unmount an open SoldierSheet and jump the scroll to the top
  const load = useRefresh(company)
  const platoons = ['HQ', ...(settingsQ.data?.platoons ?? []).map((p) => p.key)]
  // Everyone on the roll, posted-out included; `soldiers` below is who's on strength
  const allSoldiers = useMemo(() => soldiersQ.data ?? [], [soldiersQ.data])
  const exceptions = useMemo(() => exceptionsQ.data ?? [], [exceptionsQ.data])
  const [showPostedOut, setShowPostedOut] = useState(false)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [panel, setPanel] = useState<'none' | 'add' | 'import' | 'deleteAll'>('none')

  const onStrength = allSoldiers.filter(isOnStrength)
  const soldiers = showPostedOut ? allSoldiers : onStrength
  const postedOutCount = allSoldiers.length - onStrength.length

  const today = todaySGDate()
  const exceptionsByKey = useMemo(() => {
    const idx = soldierIndex(allSoldiers)
    const map = new Map<string, Exception[]>()
    for (const e of exceptions) {
      const key = exceptionSoldierKey(e, idx)
      map.set(key, [...(map.get(key) ?? []), e])
    }
    return map
  }, [allSoldiers, exceptions])
  /** A soldier's exceptions active today. */
  const activeFor = (s: Soldier) => (exceptionsByKey.get(soldierKeyOf(s)) ?? []).filter((e) => isActiveOn(e, today))
  const openSoldier = openKey ? allSoldiers.find((s) => soldierKeyOf(s) === openKey) : undefined

  if (loading) return <div className="text-ink-60 text-sm py-8 text-center">Loading...</div>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Nominal Roll</h2>
          <p className="text-xs text-ink-60">{onStrength.length} personnel</p>
        </div>
        <input
          type="search"
          placeholder="Search by rank, name, platoon, 4D…"
          aria-label="Search nominal roll"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 max-w-sm border border-hairline rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-action-focus bg-white"
        />
        {postedOutCount > 0 && (
          <button
            onClick={() => setShowPostedOut(!showPostedOut)}
            aria-pressed={showPostedOut}
            className={`px-3 py-1 text-xs rounded-full border ${showPostedOut ? 'bg-ink text-white border-ink' : 'border-hairline text-ink-80'}`}
          >
            {showPostedOut ? 'Hide' : 'Show'} posted out ({postedOutCount})
          </button>
        )}
        <div className="flex gap-2 ml-auto">
          <button onClick={() => setPanel('deleteAll')} className="px-3 py-2 border border-danger/30 text-danger hover:bg-danger/5 text-sm font-medium rounded-lg transition-colors">
            Delete All
          </button>
          <button onClick={() => setPanel('import')} className="px-3 py-2 border border-hairline text-ink-80 hover:bg-parchment text-sm font-medium rounded-lg transition-colors">
            Bulk Import
          </button>
          <button
            onClick={() => setPanel(panel === 'add' ? 'none' : 'add')}
            className={`px-3 py-2 ${THEME.buttonBg} ${THEME.buttonHoverBg} text-white text-sm font-medium rounded-lg transition-colors`}
          >
            {panel === 'add' ? 'Cancel' : '+ Add'}
          </button>
        </div>
      </div>

      {panel === 'deleteAll' && (
        <DeleteAllPanel company={company} count={allSoldiers.length} repo={soldierRepo} onDone={load} onError={setError} onCancel={() => setPanel('none')} />
      )}

      {error && <div role="alert" className="bg-danger/5 border border-danger/30 text-danger px-4 py-3 rounded-lg text-sm">{error}</div>}

      {panel === 'add' && (
        <AddSoldierForm
          platoons={platoons} repo={soldierRepo} onError={setError}
          onAdded={async () => { setPanel('none'); await load() }}
        />
      )}

      <SoldierTables
        company={company} platoons={platoons} soldiers={filterSoldiers(soldiers, search)} repo={soldierRepo}
        activeFor={activeFor} onOpen={(s) => setOpenKey(soldierKeyOf(s))} onChanged={load} onError={setError}
      />

      {soldiers.length === 0 && panel !== 'add' && (
        <div className="text-center py-16 text-ink-60">
          <p className="text-sm">No soldiers yet.</p>
          <button onClick={() => setPanel('add')} className={`mt-3 text-sm ${THEME.activeText} hover:underline`}>
            Add the first soldier
          </button>
        </div>
      )}

      {openSoldier && (
        <SoldierSheet
          company={company}
          soldier={openSoldier}
          exceptions={exceptionsByKey.get(soldierKeyOf(openSoldier)) ?? []}
          onClose={() => setOpenKey(null)}
          onChanged={() => load()}
        />
      )}

      {panel === 'import' && (
        <BulkImportModal
          company={company}
          platoons={platoons}
          soldiers={allSoldiers}
          onClose={() => setPanel('none')}
          onImported={async () => { await load(); setPanel('none') }}
        />
      )}
    </div>
  )
}
