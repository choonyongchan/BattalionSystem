'use client'

import { useRef, useState } from 'react'
import { SoldierRepository } from '@/backend/data/repositories/SoldierRepository'
import type { Soldier } from '@/shared/types'
import type { Company } from '@/shared/companies'
import { parseCSV, validateAndTransform } from '@/backend/domain/nominal-roll/bulk-import'
import type { ParsedRow, RowError } from '@/backend/domain/nominal-roll/bulk-import'
import { Button, buttonClass } from '@/frontend/components/ui/button'
import { Dialog } from '@/frontend/components/ui/dialog'
import { Banner } from '@/frontend/components/ui/layout'
import { TD, Th, rowClass } from '@/frontend/components/ui/table'

const TEMPLATE_URL = 'https://docs.google.com/spreadsheets/d/1IjFwbLWLSnoMelF92InkQBTGYk-4jal8URafSBKWEoc/edit?usp=sharing'

/** Modal to import soldiers from a CSV, with per-row validation before upsert. */
export default function BulkImportModal({
  company,
  platoons,
  soldiers,
  onClose,
  onImported,
}: {
  company: Company
  /** Platoon keys the company accepts, HQ included. */
  platoons: string[]
  soldiers: Soldier[]
  onClose: () => void
  onImported: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [valid, setValid] = useState<ParsedRow[] | null>(null)
  const [errors, setErrors] = useState<RowError[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ added: number; updated: number } | null>(null)

  /** Parses and validates the chosen CSV file. */
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      const result = validateAndTransform(rows, soldiers, platoons)
      setValid(result.valid)
      setErrors(result.errors)
      setImportResult(null)
    }
    reader.readAsText(file, 'utf-8')
  }

  /** Upserts the valid rows by name and reports added vs updated counts. */
  async function doImport() {
    if (!valid || valid.length === 0) return
    setImporting(true)
    const overwriteCount = valid.filter((r) => r.isOverwrite).length
    const payload = valid.map(({ rank, name, platoon, fourD }) => ({ rank, name, platoon, four_d: fourD }))
    const { error } = await new SoldierRepository(company).upsertMany(payload)
    if (error) {
      setErrors((prev) => [{ row: 0, message: error.message }, ...prev])
    } else {
      setImportResult({ added: valid.length - overwriteCount, updated: overwriteCount })
      onImported()
    }
    setImporting(false)
  }

  const overwriteCount = valid?.filter((r) => r.isOverwrite).length ?? 0

  return (
    <Dialog onClose={onClose} aria-label="Bulk Import Soldiers">
      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Bulk Import Soldiers</h2>
          <Button variant="icon" onClick={onClose} aria-label="Close">✕</Button>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => window.open(TEMPLATE_URL, '_blank')}>
            Download Template
          </Button>
          <label className={buttonClass({ block: true }) + ' flex-1 cursor-pointer'}>
            Upload CSV
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} data-testid="csv-upload" />
          </label>
        </div>

        {errors.length > 0 && (
          <Banner className="max-h-40 space-y-1 overflow-y-auto p-3">
            <p className="mb-1 text-xs font-semibold">{errors.length} error{errors.length !== 1 ? 's' : ''} found — fix and re-upload</p>
            {errors.map((e, i) => (
              <p key={i} className="text-xs">Row {e.row}: {e.message}</p>
            ))}
          </Banner>
        )}

        {valid && valid.length > 0 && !importResult && (
          <>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-hairline">
              <table className="w-full text-xs">
                <thead className="sticky top-0 border-b border-hairline bg-parchment">
                  <tr><Th>Rank</Th><Th>Name</Th><Th>Platoon</Th><Th>4D</Th><Th /></tr>
                </thead>
                <tbody>
                  {valid.map((row, i) => (
                    <tr key={i} className={rowClass(0, false, row.isOverwrite ? 'bg-warning/10' : undefined)}>
                      <td className={`${TD} font-mono text-ink-80`}>{row.rank}</td>
                      <td className={`${TD} font-medium`}>{row.name}</td>
                      <td className={`${TD} text-ink-60`}>{row.platoon}</td>
                      <td className={`${TD} text-ink-60`}>{row.fourD ?? '—'}</td>
                      <td className={TD}>{row.isOverwrite && <span className="font-medium text-warning">overwrite</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button block onClick={doImport} disabled={importing}>
              {importing
                ? 'Importing...'
                : `Import ${valid.length} soldier${valid.length !== 1 ? 's' : ''}${overwriteCount > 0 ? ` (${overwriteCount} overwrite${overwriteCount !== 1 ? 's' : ''})` : ''}`}
            </Button>
          </>
        )}

        {importResult && (
          <Banner tone="success">Done: {importResult.added} added, {importResult.updated} updated</Banner>
        )}
      </div>
    </Dialog>
  )
}
