'use client'

import { useRef, useState } from 'react'
import { getSupabaseClient, tbl } from '@/lib/supabase'
import type { Soldier } from '@/lib/supabase'
import type { Company } from '@/lib/companies'
import { COMPANY_THEMES } from '@/lib/companies'
import { parseCSV, validateAndTransform } from '@/lib/bulk-import'
import type { ParsedRow, RowError } from '@/lib/bulk-import'

const TEMPLATE_CSV = `(Optional e.g. 1234),(Compulsory e.g. REC PTE),(Compulsory),(Compulsory i.e. HQ 1 2 3 or 4)\n4D,RANK,NAME,PLATOON\n`

export default function BulkImportModal({
  company,
  soldiers,
  onClose,
  onImported,
}: {
  company: Company
  soldiers: Soldier[]
  onClose: () => void
  onImported: () => void
}) {
  const theme = COMPANY_THEMES[company]
  const fileRef = useRef<HTMLInputElement>(null)
  const [valid, setValid] = useState<ParsedRow[] | null>(null)
  const [errors, setErrors] = useState<RowError[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ added: number; updated: number } | null>(null)

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'nominal-roll-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      const result = validateAndTransform(rows, soldiers)
      setValid(result.valid)
      setErrors(result.errors)
      setImportResult(null)
    }
    reader.readAsText(file, 'utf-8')
  }

  async function doImport() {
    if (!valid || valid.length === 0) return
    setImporting(true)
    const supabase = getSupabaseClient(company)
    const overwriteCount = valid.filter((r) => r.isOverwrite).length
    const payload = valid.map(({ rank, name, platoon, fourD }) => ({ rank, name, platoon, four_d: fourD }))
    // @ts-ignore — tbl() return type can't narrow to a table literal so Insert resolves to never
    const { error } = await supabase.from(tbl(company, 'NominalRoll')).upsert(payload, { onConflict: 'name' })
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">Bulk Import Soldiers</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg" aria-label="Close">✕</button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={downloadTemplate}
              className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Download Template
            </button>
            <label className={`flex-1 text-center cursor-pointer py-2.5 text-sm font-medium text-white rounded-xl ${theme.buttonBg} ${theme.buttonHoverBg} transition-colors`}>
              Upload CSV
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} data-testid="csv-upload" />
            </label>
          </div>

          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1 max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold text-red-700 mb-1">{errors.length} error{errors.length !== 1 ? 's' : ''} found — fix and re-upload</p>
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">Row {e.row}: {e.message}</p>
              ))}
            </div>
          )}

          {valid && valid.length > 0 && !importResult && (
            <>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-500">Rank</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-500">Name</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-500">Platoon</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-500">4D</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-500"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {valid.map((row, i) => (
                        <tr key={i} className={`border-b border-gray-100 last:border-0 ${row.isOverwrite ? 'bg-amber-50' : ''}`}>
                          <td className="px-3 py-2 font-mono text-gray-600">{row.rank}</td>
                          <td className="px-3 py-2 font-medium">{row.name}</td>
                          <td className="px-3 py-2 text-gray-500">{row.platoon}</td>
                          <td className="px-3 py-2 text-gray-400">{row.fourD ?? '—'}</td>
                          <td className="px-3 py-2">{row.isOverwrite && <span className="text-amber-600 font-medium">overwrite</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <button
                onClick={doImport}
                disabled={importing}
                className={`w-full py-3 ${theme.buttonBg} ${theme.buttonHoverBg} text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors`}
              >
                {importing
                  ? 'Importing...'
                  : `Import ${valid.length} soldier${valid.length !== 1 ? 's' : ''}${overwriteCount > 0 ? ` (${overwriteCount} overwrite${overwriteCount !== 1 ? 's' : ''})` : ''}`}
              </button>
            </>
          )}

          {importResult && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
              Done: {importResult.added} added, {importResult.updated} updated
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
