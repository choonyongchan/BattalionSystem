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
import { Button } from '@/frontend/components/ui/button'
import { CheckField, SearchInput, Switch } from '@/frontend/components/ui/fields'
import { Banner, Empty, Loading, PageHeader } from '@/frontend/components/ui/layout'

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

  if (loading) return <Loading />

  return (
    <div className="space-y-3">
      <PageHeader
        title="Nominal Roll"
        subtitle={`${onStrength.length} personnel`}
        actions={<>
          <Button variant="danger-outline" onClick={() => setPanel('deleteAll')}>Delete All</Button>
          <Button variant="secondary" onClick={() => setPanel('import')}>Bulk Import</Button>
          <Button variant={panel === 'add' ? 'secondary' : 'primary'} onClick={() => setPanel(panel === 'add' ? 'none' : 'add')}>
            {panel === 'add' ? 'Cancel' : '+ Add'}
          </Button>
        </>}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SearchInput
          placeholder="Search by rank, name, platoon, 4D…"
          aria-label="Search nominal roll"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm flex-1 min-w-48"
        />
        {postedOutCount > 0 && (
          <CheckField label={`Show posted out (${postedOutCount})`}>
            <Switch checked={showPostedOut} onChange={(e) => setShowPostedOut(e.target.checked)} />
          </CheckField>
        )}
      </div>

      {panel === 'deleteAll' && (
        <DeleteAllPanel company={company} count={allSoldiers.length} repo={soldierRepo} onDone={load} onError={setError} onCancel={() => setPanel('none')} />
      )}

      {error && <Banner>{error}</Banner>}

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
        <Empty>
          <p>No soldiers yet.</p>
          <Button className="mt-3" onClick={() => setPanel('add')}>Add the first soldier</Button>
        </Empty>
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
