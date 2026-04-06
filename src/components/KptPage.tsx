import { useState, useEffect, useCallback, useRef } from 'react'

// ── Types ──

interface KptCategory {
  id: number
  name: string
  sort_order: number
}

interface KptEntry {
  id: number
  category_id: number
  year_week: string
  type: 'keep' | 'problem' | 'try'
  content: string
  sort_order: number
  carried_from_id: number | null
  carried_from_type: 'keep' | 'problem' | 'try' | null
  problem_status: 'resolved' | 'unresolved' | 'partial' | null
  problem_reason: string | null
  resolved_keep: string | null
  promoted_to_keep: number
  todo_id: number | null
  category_name?: string
}

interface KptStats {
  try_total: number
  try_promoted: number
  success_rate: number
  problem_stats: { problem_status: string; c: number }[]
}

// ── Helpers ──

function getCurrentYearWeek(): string {
  const d = new Date()
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((d.getTime() - jan1.getTime()) / 86400000) + 1
  const weekNum = Math.ceil((dayOfYear + jan1.getDay()) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function offsetWeek(yearWeek: string, offset: number): string {
  const [y, w] = yearWeek.replace('W', '').split('-').map(Number)
  // Approximate: get a date in that week, add 7*offset days
  const jan4 = new Date(y, 0, 4) // Jan 4 is always in week 1
  const dayOfWeek = jan4.getDay() || 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (w - 1) * 7)
  monday.setDate(monday.getDate() + offset * 7)
  // Recalculate year_week
  const newYear = monday.getFullYear()
  const jan1 = new Date(newYear, 0, 1)
  const dayOfYear = Math.floor((monday.getTime() - jan1.getTime()) / 86400000) + 1
  const newWeek = Math.ceil((dayOfYear + jan1.getDay()) / 7)
  return `${newYear}-W${String(newWeek).padStart(2, '0')}`
}

function formatWeekLabel(yearWeek: string): string {
  const [y, w] = yearWeek.replace('W', '').split('-').map(Number)
  const jan4 = new Date(y, 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (w - 1) * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
  return `${y}年 第${w}週（${fmt(monday)}〜${fmt(sunday)}）`
}

const API = '/api/kpt'

function apiFetch(url: string, opts?: RequestInit) {
  return fetch(url, { credentials: 'include', ...opts })
}

// ── Inline Edit Component ──

function InlineEdit({
  value,
  onSave,
  placeholder,
  disabled,
}: {
  value: string
  onSave: (v: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus()
      ref.current.style.height = 'auto'
      ref.current.style.height = ref.current.scrollHeight + 'px'
    }
  }, [editing])

  if (disabled && !value) return null
  if (disabled) return <span className="text-sm text-[#c0c0d0]">{value}</span>

  if (!editing) {
    return (
      <button
        className="text-left text-sm text-[#c0c0d0] hover:text-white w-full min-h-[24px] rounded px-1 -mx-1 hover:bg-[#2a2a3a]/50 transition-colors"
        onClick={() => setEditing(true)}
      >
        {value || <span className="text-[#5a5a6e] italic">{placeholder ?? '入力...'}</span>}
      </button>
    )
  }

  return (
    <textarea
      ref={ref}
      className="w-full text-sm bg-[#1a1a2a] text-[#e4e4ec] border border-[#3a3a4e] rounded px-1 py-0.5 resize-none focus:outline-none focus:border-amber-500/50"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value)
        e.target.style.height = 'auto'
        e.target.style.height = e.target.scrollHeight + 'px'
      }}
      onBlur={() => {
        setEditing(false)
        if (draft !== value) onSave(draft)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          setEditing(false)
          if (draft !== value) onSave(draft)
        }
        if (e.key === 'Escape') {
          setDraft(value)
          setEditing(false)
        }
      }}
      rows={1}
    />
  )
}

// ── Main Component ──

export default function KptPage() {
  const [yearWeek, setYearWeek] = useState(getCurrentYearWeek)
  const [categories, setCategories] = useState<KptCategory[]>([])
  const [entries, setEntries] = useState<KptEntry[]>([])
  const [prevProblems, setPrevProblems] = useState<KptEntry[]>([])
  const [stats, setStats] = useState<KptStats | null>(null)
  const [newCatName, setNewCatName] = useState('')
  const [showStats, setShowStats] = useState(false)

  const currentWeek = getCurrentYearWeek()
  const isCurrentWeek = yearWeek === currentWeek
  const isPastWeek = yearWeek < currentWeek

  // ── Data loading ──

  const loadCategories = useCallback(() => {
    apiFetch(`${API}/categories`).then(r => r.json()).then(setCategories)
  }, [])

  const loadEntries = useCallback(() => {
    apiFetch(`${API}/entries?year_week=${yearWeek}`).then(r => r.json()).then(setEntries)
  }, [yearWeek])

  const loadPrevProblems = useCallback(() => {
    apiFetch(`${API}/prev-problems?year_week=${yearWeek}`).then(r => r.json()).then(setPrevProblems)
  }, [yearWeek])

  const loadStats = useCallback(() => {
    apiFetch(`${API}/stats`).then(r => r.json()).then(setStats)
  }, [])

  useEffect(() => { loadCategories() }, [loadCategories])
  useEffect(() => { loadEntries(); loadPrevProblems() }, [loadEntries, loadPrevProblems])
  useEffect(() => { if (showStats) loadStats() }, [showStats, loadStats])

  // ── Handlers ──

  const addCategory = () => {
    if (!newCatName.trim()) return
    apiFetch(`${API}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName.trim() }),
    }).then(() => { setNewCatName(''); loadCategories() })
  }

  const deleteCategory = (id: number) => {
    apiFetch(`${API}/categories/${id}`, { method: 'DELETE' }).then(() => { loadCategories(); loadEntries() })
  }

  const addEntry = (categoryId: number, type: 'keep' | 'problem' | 'try') => {
    apiFetch(`${API}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, year_week: yearWeek, type, content: '' }),
    }).then(() => loadEntries())
  }

  const updateEntry = (id: number, data: Partial<KptEntry>) => {
    apiFetch(`${API}/entries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(() => { loadEntries(); loadPrevProblems() })
  }

  const deleteEntry = (id: number) => {
    apiFetch(`${API}/entries/${id}`, { method: 'DELETE' }).then(() => loadEntries())
  }

  const carryKeep = (id: number) => {
    const nextWeek = offsetWeek(yearWeek, 1)
    apiFetch(`${API}/entries/${id}/carry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_week: nextWeek }),
    }).then(r => {
      if (r.ok) loadEntries()
      else r.json().then(d => alert(d.error))
    })
  }


  // ── Group entries by category ──

  const entriesByCat = new Map<number, { keep: KptEntry[]; problem: KptEntry[]; try: KptEntry[] }>()
  for (const cat of categories) {
    entriesByCat.set(cat.id, { keep: [], problem: [], try: [] })
  }
  for (const e of entries) {
    const group = entriesByCat.get(e.category_id)
    if (group) group[e.type].push(e)
  }

  // Previous problems grouped by category
  const prevProbByCat = new Map<number, KptEntry[]>()
  for (const p of prevProblems) {
    const arr = prevProbByCat.get(p.category_id) ?? []
    arr.push(p)
    prevProbByCat.set(p.category_id, arr)
  }

  // Count weeks a problem has been unresolved (by content match)
  const unresolvedWeeks = new Map<string, number>()
  for (const p of prevProblems) {
    if (!p.problem_status || p.problem_status === 'unresolved') {
      const key = `${p.category_id}:${p.content}`
      unresolvedWeeks.set(key, (unresolvedWeeks.get(key) ?? 0) + 1)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">KPT 振り返り</h1>
          <p className="text-sm text-[#8b8b9e] mt-1">{formatWeekLabel(yearWeek)}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setYearWeek(w => offsetWeek(w, -1))}
            className="px-3 py-1.5 text-sm bg-[#1e1e2a] text-[#8b8b9e] border border-[#2a2a3a] rounded-md hover:text-white transition-colors"
          >
            ← 前週
          </button>
          {!isCurrentWeek && (
            <button
              onClick={() => setYearWeek(currentWeek)}
              className="px-3 py-1.5 text-sm bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-md hover:bg-amber-500/20 transition-colors"
            >
              今週
            </button>
          )}
          <button
            onClick={() => setYearWeek(w => offsetWeek(w, 1))}
            className="px-3 py-1.5 text-sm bg-[#1e1e2a] text-[#8b8b9e] border border-[#2a2a3a] rounded-md hover:text-white transition-colors"
          >
            次週 →
          </button>
          <button
            onClick={() => setShowStats(s => !s)}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
              showStats
                ? 'bg-violet-900/30 text-violet-400 border-violet-500/40'
                : 'bg-[#1e1e2a] text-[#8b8b9e] border-[#2a2a3a] hover:text-white'
            }`}
          >
            統計
          </button>
        </div>
      </div>

      {/* ── Stats panel ── */}
      {showStats && stats && (
        <div className="bg-[#16161e] rounded-xl border border-[#2a2a3a] p-4 space-y-3">
          <h2 className="text-base font-semibold text-white">改善成功率</h2>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-[#8b8b9e]">Try 総数:</span>
              <span className="text-white ml-1">{stats.try_total}</span>
            </div>
            <div>
              <span className="text-[#8b8b9e]">Keep に昇格:</span>
              <span className="text-green-400 ml-1">{stats.try_promoted}</span>
            </div>
            <div>
              <span className="text-[#8b8b9e]">成功率:</span>
              <span className={`ml-1 font-bold ${stats.success_rate >= 50 ? 'text-green-400' : stats.success_rate >= 25 ? 'text-amber-400' : 'text-red-400'}`}>
                {stats.success_rate}%
              </span>
            </div>
          </div>
          {stats.problem_stats.length > 0 && (
            <div className="flex gap-4 text-sm">
              <span className="text-[#8b8b9e]">Problem:</span>
              {stats.problem_stats.map(p => (
                <span key={p.problem_status} className="text-[#c0c0d0]">
                  {p.problem_status === 'resolved' ? '解決済' : p.problem_status === 'partial' ? '部分解決' : '未解決'}: {p.c}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Add category ── */}
      {!isPastWeek && (
        <div className="flex gap-2">
          <input
            className="flex-1 text-sm bg-[#1a1a2a] text-[#e4e4ec] border border-[#2a2a3a] rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500/50 placeholder:text-[#5a5a6e]"
            placeholder="新しいカテゴリを追加..."
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
          />
          <button
            onClick={addCategory}
            className="px-3 py-2 text-sm bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors"
          >
            追加
          </button>
        </div>
      )}

      {/* ── Category tiles ── */}
      {categories.length === 0 ? (
        <div className="text-center py-12 text-[#5a5a6e] text-base">
          カテゴリを追加して KPT 振り返りを始めましょう
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map(cat => {
            const group = entriesByCat.get(cat.id) ?? { keep: [], problem: [], try: [] }
            const catPrevProb = prevProbByCat.get(cat.id) ?? []

            return (
              <div key={cat.id} className="bg-[#16161e] rounded-xl border border-[#2a2a3a] overflow-hidden">
                {/* Category header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2a2a3a] bg-[#1a1a2a]">
                  <h3 className="text-base font-semibold text-white">{cat.name}</h3>
                  {!isPastWeek && (
                    <button
                      onClick={() => { if (confirm(`「${cat.name}」を削除しますか？`)) deleteCategory(cat.id) }}
                      className="text-xs text-[#5a5a6e] hover:text-red-400 transition-colors"
                    >
                      削除
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#2a2a3a]">
                  {/* Keep */}
                  <KptSection
                    type="keep"
                    label="Keep"
                    color="green"
                    entries={group.keep}
                    isPast={isPastWeek}
                    onAdd={() => addEntry(cat.id, 'keep')}
                    onUpdate={updateEntry}
                    onDelete={deleteEntry}
                    onCarry={carryKeep}
                  />

                  {/* Problem */}
                  <KptSection
                    type="problem"
                    label="Problem"
                    color="red"
                    entries={group.problem}
                    isPast={isPastWeek}
                    onAdd={() => addEntry(cat.id, 'problem')}
                    onUpdate={updateEntry}
                    onDelete={deleteEntry}
                    prevProblems={catPrevProb}
                    unresolvedWeeks={unresolvedWeeks}
                    allKeeps={entries.filter(e => e.type === 'keep' && e.content)}
                  />

                  {/* Try */}
                  <KptSection
                    type="try"
                    label="Try"
                    color="blue"
                    entries={group.try}
                    isPast={isPastWeek}
                    onAdd={() => addEntry(cat.id, 'try')}
                    onUpdate={updateEntry}
                    onDelete={deleteEntry}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Section Component ──

function KptSection({
  type,
  label,
  color,
  entries,
  isPast,
  onAdd,
  onUpdate,
  onDelete,
  onCarry,
  prevProblems,
  unresolvedWeeks,
  allKeeps,
}: {
  type: 'keep' | 'problem' | 'try'
  label: string
  color: string
  entries: KptEntry[]
  isPast: boolean
  onAdd: () => void
  onUpdate: (id: number, data: Partial<KptEntry>) => void
  onDelete: (id: number) => void
  onCarry?: (id: number) => void
  prevProblems?: KptEntry[]
  unresolvedWeeks?: Map<string, number>
  allKeeps?: KptEntry[]
}) {
  const colorMap: Record<string, { header: string; dot: string; badge: string; addBtn: string }> = {
    green: {
      header: 'text-green-400',
      dot: 'bg-green-500',
      badge: 'bg-green-500/15 text-green-400 border-green-500/30',
      addBtn: 'text-green-400/60 hover:text-green-400 hover:bg-green-500/10',
    },
    red: {
      header: 'text-red-400',
      dot: 'bg-red-500',
      badge: 'bg-red-500/15 text-red-400 border-red-500/30',
      addBtn: 'text-red-400/60 hover:text-red-400 hover:bg-red-500/10',
    },
    blue: {
      header: 'text-blue-400',
      dot: 'bg-blue-500',
      badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      addBtn: 'text-blue-400/60 hover:text-blue-400 hover:bg-blue-500/10',
    },
  }

  const c = colorMap[color]

  return (
    <div className="p-3 min-h-[120px] flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${c.dot}`} />
          <span className={`text-sm font-semibold ${c.header}`}>{label}</span>
          <span className="text-xs text-[#5a5a6e]">({entries.length})</span>
        </div>
        {!isPast && (
          <button
            onClick={onAdd}
            className={`text-lg leading-none px-1 rounded transition-colors ${c.addBtn}`}
          >
            +
          </button>
        )}
      </div>

      {/* Previous problems reference with evaluation buttons */}
      {type === 'problem' && prevProblems && prevProblems.length > 0 && (
        <div className="mb-2 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
          <div className="text-[11px] text-red-400/50 font-medium mb-1">前週の Problem</div>
          {prevProblems.map(p => {
            const weeks = unresolvedWeeks?.get(`${p.category_id}:${p.content}`) ?? 0
            return (
              <div key={p.id} className="mb-1.5">
                <div className="text-xs text-red-300/60 flex items-start gap-1">
                  <span className="shrink-0">•</span>
                  <span className={weeks >= 2 ? 'text-red-400 font-semibold' : ''}>{p.content}</span>
                  {weeks >= 2 && (
                    <span className="shrink-0 text-[10px] px-1 py-px rounded bg-red-500/20 text-red-400 ml-auto">
                      {weeks}週継続
                    </span>
                  )}
                </div>
                {!isPast && (
                  <div className="mt-0.5 ml-3 space-y-1">
                    <div className="flex items-center gap-1">
                      {(['resolved', 'partial', 'unresolved'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => onUpdate(p.id, { problem_status: s })}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                            p.problem_status === s
                              ? s === 'resolved' ? 'bg-green-500/20 text-green-400 border-green-500/40'
                                : s === 'partial' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                : 'bg-red-500/20 text-red-400 border-red-500/40'
                              : 'bg-[#1a1a2a] text-[#5a5a6e] border-[#2a2a3a] hover:text-[#8b8b9e]'
                          }`}
                        >
                          {s === 'resolved' ? '解決' : s === 'partial' ? '部分解決' : '未解決'}
                        </button>
                      ))}
                    </div>
                    {/* Contextual input fields based on status */}
                    {p.problem_status === 'unresolved' && (
                      <div className="text-[11px]">
                        <span className="text-red-400/50">理由:</span>
                        <InlineEdit
                          value={p.problem_reason ?? ''}
                          onSave={(v) => onUpdate(p.id, { problem_reason: v })}
                          placeholder="未解決の理由..."
                        />
                      </div>
                    )}
                    {p.problem_status === 'resolved' && (
                      <div className="text-[11px]">
                        <span className="text-green-400/50">効果があったKeep:</span>
                        <select
                          value={p.resolved_keep ?? ''}
                          onChange={(e) => onUpdate(p.id, { resolved_keep: e.target.value } as any)}
                          className="w-full mt-0.5 text-[11px] bg-[#1a1a2a] text-[#e4e4ec] border border-[#3a3a4e] rounded px-1 py-0.5 focus:outline-none focus:border-green-500/50"
                        >
                          <option value="">選択してください</option>
                          {allKeeps?.map(k => (
                            <option key={k.id} value={k.content}>{k.content}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {p.problem_status === 'partial' && (
                      <div className="space-y-0.5 text-[11px]">
                        <div>
                          <span className="text-amber-400/50">効果があったKeep:</span>
                          <select
                            value={p.resolved_keep ?? ''}
                            onChange={(e) => onUpdate(p.id, { resolved_keep: e.target.value } as any)}
                            className="w-full mt-0.5 text-[11px] bg-[#1a1a2a] text-[#e4e4ec] border border-[#3a3a4e] rounded px-1 py-0.5 focus:outline-none focus:border-amber-500/50"
                          >
                            <option value="">選択してください</option>
                            {allKeeps?.map(k => (
                              <option key={k.id} value={k.content}>{k.content}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <span className="text-amber-400/50">残った理由:</span>
                          <InlineEdit
                            value={p.problem_reason ?? ''}
                            onSave={(v) => onUpdate(p.id, { problem_reason: v })}
                            placeholder="部分的に残った理由..."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Entries */}
      <div className="space-y-1.5 flex-1">
        {entries.map(e => (
          <div key={e.id} className="group flex items-start gap-1.5">
            <span className={`w-1 h-1 rounded-full ${c.dot} mt-1.5 shrink-0 opacity-40`} />
            <div className="flex-1 min-w-0">
              <InlineEdit
                value={e.content}
                onSave={(v) => onUpdate(e.id, { content: v })}
                disabled={isPast}
                placeholder={`${label}を入力...`}
              />

              {/* Carried badge */}
              {/* Keep badges */}
              {type === 'keep' && e.carried_from_id && e.carried_from_type === 'keep' && (
                <span className="text-[10px] px-1 py-px rounded bg-green-500/15 text-green-400/60 ml-1">
                  先週から継続
                </span>
              )}
              {type === 'keep' && e.carried_from_id && e.carried_from_type === 'try' && (
                <span className="text-[10px] px-1 py-px rounded bg-blue-500/15 text-blue-400/60 ml-1">
                  Tryから昇格
                </span>
              )}

              {/* Problem badges */}
              {type === 'problem' && e.carried_from_id && e.carried_from_type === 'problem' && (
                <div className="mt-0.5">
                  <span className="text-[10px] px-1 py-px rounded bg-red-500/15 text-red-400/60">
                    先週から継続
                  </span>
                  {e.problem_reason && (
                    <span className="text-[11px] text-[#8b8b9e] block mt-0.5">{e.problem_reason}</span>
                  )}
                </div>
              )}
              {type === 'problem' && !e.carried_from_id && e.problem_status && (
                <span className={`text-[10px] px-1 py-px rounded mt-0.5 inline-block ${
                  e.problem_status === 'resolved' ? 'bg-green-500/15 text-green-400/60'
                    : e.problem_status === 'partial' ? 'bg-amber-500/15 text-amber-400/60'
                    : 'bg-red-500/15 text-red-400/60'
                }`}>
                  {e.problem_status === 'resolved' ? '解決済' : e.problem_status === 'partial' ? '部分解決' : '未解決'}
                </span>
              )}
              {type === 'problem' && !e.carried_from_id && e.problem_status && e.problem_reason && (
                <span className="text-[11px] text-[#8b8b9e] block mt-0.5">理由: {e.problem_reason}</span>
              )}
              {type === 'problem' && e.problem_status && e.resolved_keep && (
                <span className="text-[11px] text-green-400/60 block mt-0.5">効果Keep: {e.resolved_keep}</span>
              )}

            </div>

            {/* Delete button */}
            {!isPast && (
              <button
                onClick={() => onDelete(e.id)}
                className="opacity-0 group-hover:opacity-100 text-[#5a5a6e] hover:text-red-400 transition-all text-sm shrink-0 mt-0.5"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Keep carry buttons */}
      {type === 'keep' && onCarry && entries.length > 0 && !isPast && (
        <div className="mt-2 pt-2 border-t border-[#2a2a3a]">
          <button
            onClick={() => entries.forEach(e => { if (e.content) onCarry(e.id) })}
            className="text-[11px] text-green-400/50 hover:text-green-400 transition-colors"
          >
            全Keepを次週に引き継ぎ →
          </button>
        </div>
      )}
    </div>
  )
}
