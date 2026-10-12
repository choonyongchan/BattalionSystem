'use client'

import { useRef, useState } from 'react'
import { SoldierRepository } from '@/backend/data/repositories/SoldierRepository'
import type { Soldier } from '@/shared/types'
import type { Company } from '@/shared/companies'
import { parseCSV, validateAndTransform } from '@/backend/domain/nominal-roll/bulk-import'
import type { ParsedRow, RowError } from '@/backend/domain/nominal-roll/bulk-import'
import { THEME } from '@/frontend/theme'

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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Bulk Import Soldiers">
      <div className="bg-white rounded-card w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Bulk Import Soldiers</h2>
            <button onClick={onClose} className="text-ink-60 hover:text-ink-80 text-lg" aria-label="Close">✕</button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => window.open(TEMPLATE_URL, '_blank')}
              className="flex-1 border border-hairline rounded-lg py-2.5 text-sm text-ink-80 hover:bg-parchment transition-colors"
            >
              Download Template
            </button>
            <label className={`flex-1 text-center cursor-pointer py-2.5 text-sm font-medium text-white rounded-lg ${THEME.buttonBg} ${THEME.buttonHoverBg} transition-colors`}>
              Upload CSV
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} data-testid="csv-upload" />
            </label>
          </div>

          {errors.length > 0 && (
            <div className="bg-danger/5 border border-danger/30 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold text-danger mb-1">{errors.length} error{errors.length !== 1 ? 's' : ''} found — fix and re-upload</p>
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-danger">Row {e.row}: {e.message}</p>
              ))}
            </div>
          )}

          {valid && valid.length > 0 && !importResult && (
            <>
              <div className="border border-hairline rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-parchment border-b border-hairline">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-ink-60">Rank</th>
                        <th className="text-left px-3 py-2 font-medium text-ink-60">Name</th>
                        <th className="text-left px-3 py-2 font-medium text-ink-60">Platoon</th>
                        <th className="text-left px-3 py-2 font-medium text-ink-60">4D</th>
                        <th className="text-left px-3 py-2 font-medium text-ink-60"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {valid.map((row, i) => (
                        <tr key={i} className={`border-b border-hairline last:border-0 ${row.isOverwrite ? 'bg-amber-50' : ''}`}>
                          <td className="px-3 py-2 font-mono text-ink-80">{row.rank}</td>
                          <td className="px-3 py-2 font-medium">{row.name}</td>
                          <td className="px-3 py-2 text-ink-60">{row.platoon}</td>
                          <td className="px-3 py-2 text-ink-60">{row.fourD ?? '—'}</td>
                          <td className="px-3 py-2">{row.isOverwrite && <span className="text-amber-700 font-medium">overwrite</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <button
                onClick={doImport}
                disabled={importing}
                className={`w-full py-3 ${THEME.buttonBg} ${THEME.buttonHoverBg} text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors`}
              >
                {importing
                  ? 'Importing...'
                  : `Import ${valid.length} soldier${valid.length !== 1 ? 's' : ''}${overwriteCount > 0 ? ` (${overwriteCount} overwrite${overwriteCount !== 1 ? 's' : ''})` : ''}`}
              </button>
            </>
          )}

          {importResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              Done: {importResult.added} added, {importResult.updated} updated
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
