import { useState, useRef } from 'react'
import { useApi, apiPost, apiDelete } from '../../hooks/useApi'
import type { BudgetActual } from './types'

function fmt(v: number): string {
  if (v >= 0) return `¥${v.toLocaleString()}`
  return `-¥${Math.abs(v).toLocaleString()}`
}

function splitCsvLine(line: string): string[] {
  const cols: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        cols.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  cols.push(current)
  return cols
}

function parseCsv(text: string) {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  // Handle BOM
  const header = splitCsvLine(lines[0].replace(/^\uFEFF/, ''))
  const calcIdx = header.indexOf('計算対象')
  const dateIdx = header.indexOf('日付')
  const descIdx = header.indexOf('内容')
  const amountIdx = header.indexOf('金額（円）')
  const sourceIdx = header.indexOf('保有金融機関')
  const catIdx = header.indexOf('大項目')
  const subIdx = header.indexOf('中項目')
  const memoIdx = header.indexOf('メモ')
  const transferIdx = header.indexOf('振替')
  const idIdx = header.indexOf('ID')

  if (calcIdx < 0 || dateIdx < 0 || amountIdx < 0) return []

  return lines.slice(1).map(line => {
    const cols = splitCsvLine(line)
    return {
      calc: cols[calcIdx] || '',
      date: cols[dateIdx] || '',
      description: cols[descIdx] || '',
      amount: parseInt((cols[amountIdx] || '0').replace(/,/g, ''), 10),
      source: cols[sourceIdx] || '',
      category: cols[catIdx] || '',
      subcategory: cols[subIdx] || '',
      memo: cols[memoIdx] || '',
      transfer: cols[transferIdx] || '',
      csv_id: cols[idIdx] || '',
    }
  })
}

export default function CsvImportTab({ yearMonth }: { yearMonth: string }) {
  const { data: actuals, refetch } = useApi<BudgetActual[]>(`/api/budget-mgmt/actuals/${yearMonth}`)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setResult(null)

    try {
      const text = await file.text()
      const rows = parseCsv(text)
      const res = await apiPost<{ imported: number; skipped: number }>('/api/budget-mgmt/actuals/import', { rows })
      setResult(res)
      refetch()
    } catch {
      setResult({ imported: 0, skipped: -1 })
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleClear = async () => {
    if (!confirm(`${yearMonth} の実績データを全て削除しますか？`)) return
    await apiDelete(`/api/budget-mgmt/actuals/${yearMonth}`)
    refetch()
    setResult(null)
  }

  // Group actuals by category
  const grouped = new Map<string, { total: number; items: BudgetActual[] }>()
  actuals?.forEach(a => {
    const existing = grouped.get(a.category_name) || { total: 0, items: [] }
    existing.total += a.amount
    existing.items.push(a)
    grouped.set(a.category_name, existing)
  })
  const sortedGroups = [...grouped.entries()].sort((a, b) => a[1].total - b[1].total)

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div className="bg-[#16161e] rounded-2xl border border-[#2a2a3a] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#2a2a3a] bg-gradient-to-r from-sky-500/8 from-[#16161e]">
          <span className="text-sm font-semibold text-[#e4e4ec]">MoneyForward CSV取込</span>
        </div>
        <div className="px-5 py-4">
          <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-[#2a2a3a] rounded-xl hover:border-sky-500/40 transition-colors cursor-pointer">
            <svg className="w-8 h-8 text-[#5a5a6e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-sm text-[#8b8b9e]">
              {importing ? '取込中...' : 'CSVファイルを選択'}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFile}
              disabled={importing}
              className="hidden"
            />
          </label>

          {actuals && actuals.length > 0 && (
            <button
              onClick={handleClear}
              className="mt-3 w-full px-4 py-2 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
            >
              取込済みデータを全削除（{actuals.length}件）
            </button>
          )}

          {result && (
            <div className={`mt-3 px-4 py-2 rounded-lg text-sm ${
              result.skipped === -1
                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              {result.skipped === -1
                ? 'エラーが発生しました'
                : `${result.imported}件取込、${result.skipped}件スキップ`}
            </div>
          )}
        </div>
      </div>

      {/* Imported data summary */}
      {actuals && actuals.length > 0 && (
        <>
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-[#5a5a6e]">{actuals.length}件の実績データ</span>
            <button
              onClick={handleClear}
              className="text-[10px] px-2 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
            >
              クリア
            </button>
          </div>

          {sortedGroups.map(([catName, group]) => (
            <div key={catName} className="bg-[#16161e] rounded-2xl border border-[#2a2a3a] overflow-hidden">
              <div className="px-5 py-2.5 border-b border-[#2a2a3a] flex items-center justify-between">
                <span className="text-sm font-semibold text-[#e4e4ec]">{catName}</span>
                <span className={`text-sm font-mono ${group.total < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {fmt(group.total)}
                </span>
              </div>
              <div className="px-5 max-h-48 overflow-y-auto">
                {group.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-[#1e1e2a] last:border-0 gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-[#e4e4ec] truncate">{item.description}</div>
                      <div className="text-[10px] text-[#5a5a6e]">{item.date} · {item.subcategory_name}</div>
                    </div>
                    <span className={`text-xs font-mono shrink-0 ${item.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {fmt(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
