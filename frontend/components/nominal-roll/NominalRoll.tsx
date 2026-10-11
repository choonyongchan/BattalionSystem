'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Exception, Soldier } from '@/shared/types'
import type { Company } from '@/shared/companies'
import { COMPANY_THEMES, PARADE_CONFIG } from '@/shared/companies'
import { todaySGDate } from '@/shared/dates'
import { SoldierRepository } from '@/backend/data/repositories/SoldierRepository'
import { ExceptionRepository } from '@/backend/data/repositories/ExceptionRepository'
import { exceptionSoldierKey, isActiveOn, isOnStrength, soldierIndex, soldierKeyOf } from '@/backend/domain/exceptions/active'
import { filterSoldiers } from '@/backend/domain/nominal-roll/roster'
import SoldierSheet from '@/frontend/components/soldier/SoldierSheet'
import BulkImportModal from './BulkImportModal'
import AddSoldierForm from './AddSoldierForm'
import DeleteAllPanel from './DeleteAllPanel'
import SoldierTables from './SoldierTables'

/** Nominal Roll tab: search, add, bulk import, edit and delete soldiers; opens a soldier's sheet. */
export default function NominalRoll({ company }: { company: Company }) {
  const theme = COMPANY_THEMES[company]
  const platoons = ['HQ', ...PARADE_CONFIG[company].platoons.map((p) => p.key)]
  const soldierRepo = useMemo(() => new SoldierRepository(company), [company])

  // Everyone on the roll, posted-out included; `soldiers` below is who's on strength
  const [allSoldiers, setAllSoldiers] = useState<Soldier[]>([])
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPostedOut, setShowPostedOut] = useState(false)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [panel, setPanel] = useState<'none' | 'add' | 'import' | 'deleteAll'>('none')

  useEffect(() => {
    setLoading(true)
    load()
  }, [company])

  /** Refreshes in place — a "Loading..." swap would unmount an open SoldierSheet and jump the scroll to the top. */
  async function load() {
    setError(null)
    const [rollRes, exRes] = await Promise.all([soldierRepo.list(true), new ExceptionRepository(company).list()])
    if (rollRes.error) setError(rollRes.error.message)
    else setAllSoldiers(rollRes.data)
    setExceptions(exRes.data)
    setLoading(false)
  }

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

  if (loading) return <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Nominal Roll</h2>
          <p className="text-xs text-gray-500">{onStrength.length} personnel</p>
        </div>
        <input
          type="search"
          placeholder="Search by rank, name, platoon, 4D…"
          aria-label="Search nominal roll"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 max-w-sm border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
        />
        {postedOutCount > 0 && (
          <button
            onClick={() => setShowPostedOut(!showPostedOut)}
            aria-pressed={showPostedOut}
            className={`px-3 py-1 text-xs rounded-full border ${showPostedOut ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300 text-gray-600'}`}
          >
            {showPostedOut ? 'Hide' : 'Show'} posted out ({postedOutCount})
          </button>
        )}
        <div className="flex gap-2 ml-auto">
          <button onClick={() => setPanel('deleteAll')} className="px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-xl transition-colors">
            Delete All
          </button>
          <button onClick={() => setPanel('import')} className="px-3 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium rounded-xl transition-colors">
            Bulk Import
          </button>
          <button
            onClick={() => setPanel(panel === 'add' ? 'none' : 'add')}
            className={`px-3 py-2 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-sm font-medium rounded-xl transition-colors`}
          >
            {panel === 'add' ? 'Cancel' : '+ Add'}
          </button>
        </div>
      </div>

      {panel === 'deleteAll' && (
        <DeleteAllPanel company={company} count={allSoldiers.length} repo={soldierRepo} onDone={load} onError={setError} onCancel={() => setPanel('none')} />
      )}

      {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

      {panel === 'add' && (
        <AddSoldierForm
          theme={theme} platoons={platoons} repo={soldierRepo} onError={setError}
          onAdded={async () => { setPanel('none'); await load() }}
        />
      )}

      <SoldierTables
        company={company} theme={theme} platoons={platoons} soldiers={filterSoldiers(soldiers, search)} repo={soldierRepo}
        activeFor={activeFor} onOpen={(s) => setOpenKey(soldierKeyOf(s))} onChanged={load} onError={setError}
      />

      {soldiers.length === 0 && panel !== 'add' && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No soldiers yet.</p>
          <button onClick={() => setPanel('add')} className={`mt-3 text-sm ${theme.activeText} hover:underline`}>
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
          soldiers={allSoldiers}
          onClose={() => setPanel('none')}
          onImported={async () => { await load(); setPanel('none') }}
        />
      )}
    </div>
  )
}
