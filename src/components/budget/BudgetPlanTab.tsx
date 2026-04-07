import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useApi, apiPut, apiPost, apiDelete } from '../../hooks/useApi'
import type { BudgetCategory, BudgetPlan, BudgetIncome, PointType, PointBalanceV2 } from './types'

interface WishItemForPlan {
  id: number; title: string; price: number | null; deadline: string | null; done: number; payment_method: string
}

function fmt(v: number): string {
  return `¥${Math.abs(v).toLocaleString()}`
}

// Formula item: label + amount × multiplier
interface FormulaItem {
  label: string
  amount: number
  multiplier: number
}

function parseFormula(raw: string | null): FormulaItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch { /* ignore */ }
  return []
}

function serializeFormula(items: FormulaItem[]): string | null {
  const valid = items.filter(i => i.label || i.amount || i.multiplier !== 1)
  if (valid.length === 0) return null
  return JSON.stringify(valid)
}

function calcFormulaTotal(items: FormulaItem[]): number {
  return items.reduce((sum, i) => sum + Math.round(i.amount * i.multiplier), 0)
}

// ── FormulaRow: a single structured formula item ──
function FormulaRow({
  item,
  onChange,
  onRemove,
}: {
  item: FormulaItem
  onChange: (updated: FormulaItem) => void
  onRemove: () => void
}) {
  const result = Math.round(item.amount * item.multiplier)
  return (
    <div className="flex items-center gap-1.5 py-1">
      <input
        type="text"
        value={item.label}
        onChange={e => onChange({ ...item, label: e.target.value })}
        placeholder="項目名"
        className="w-20 bg-transparent border-b border-[#2a2a3a] text-xs text-violet-300 placeholder-[#3a3a4a] focus:border-violet-500/50 focus:outline-none px-1 py-0.5 truncate"
      />
      <div className="relative shrink-0">
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[#5a5a6e]">¥</span>
        <input
          type="text"
          inputMode="numeric"
          value={item.amount || ''}
          onChange={e => {
            const v = e.target.value.replace(/[^0-9]/g, '')
            onChange({ ...item, amount: v ? parseInt(v, 10) : 0 })
          }}
          placeholder="0"
          className="w-16 bg-[#0e0e12] border border-[#2a2a3a] rounded pl-4 pr-1 py-0.5 text-xs text-right text-white placeholder-[#3a3a4a] focus:border-violet-500/40 focus:outline-none font-mono"
        />
      </div>
      <span className="text-[10px] text-[#5a5a6e]">×</span>
      <input
        type="text"
        inputMode="numeric"
        value={item.multiplier || ''}
        onChange={e => {
          const v = e.target.value.replace(/[^0-9.]/g, '')
          onChange({ ...item, multiplier: v ? parseFloat(v) : 0 })
        }}
        placeholder="1"
        className="w-10 bg-[#0e0e12] border border-[#2a2a3a] rounded px-1 py-0.5 text-xs text-center text-white placeholder-[#3a3a4a] focus:border-violet-500/40 focus:outline-none font-mono"
      />
      <span className="text-[10px] text-[#5a5a6e]">=</span>
      <span className="text-xs font-mono text-violet-300/80 w-16 text-right shrink-0">
        {item.amount ? fmt(result) : ''}
      </span>
      <button
        onClick={onRemove}
        className="text-[#3a3a4a] hover:text-red-400 transition-colors text-xs leading-none shrink-0"
      >
        ×
      </button>
    </div>
  )
}

// ── PlanInput: subcategory row with expandable edit panel ──
function PlanInput({
  subcategoryId,
  subcategoryName,
  currentAmount,
  isRecurring,
  currentFormula,
  onSave,
  onDelete,
  onRename,
}: {
  subcategoryId: number
  subcategoryName: string
  currentAmount: number
  isRecurring: number
  currentFormula: string | null
  onSave: (subcategoryId: number, amount: number, isRecurring: number, formula?: string | null) => void
  onDelete: (subcategoryId: number) => void
  onRename: (subcategoryId: number, name: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editName, setEditName] = useState(subcategoryName)
  const [raw, setRaw] = useState(currentAmount ? String(currentAmount) : '')
  const [recurring, setRecurring] = useState(isRecurring)
  const [useFormula, setUseFormula] = useState(false)
  const [formulaItems, setFormulaItems] = useState<FormulaItem[]>([])

  const hasFormula = parseFormula(currentFormula).length > 0

  // Sync from server when not expanded (server is source of truth when panel is closed)
  const prevFormulaRef = useRef(currentFormula)
  useEffect(() => {
    if (!expanded) {
      setRaw(currentAmount ? String(currentAmount) : '')
      setRecurring(isRecurring)
    }
    if (currentFormula !== prevFormulaRef.current) {
      prevFormulaRef.current = currentFormula
    }
  }, [currentAmount, isRecurring, currentFormula, expanded])

  const handleExpand = () => {
    if (!expanded) {
      // Opening: initialize edit state from server data
      setEditName(subcategoryName)
      setRaw(currentAmount ? String(currentAmount) : '')
      setRecurring(isRecurring)
      const saved = parseFormula(currentFormula)
      if (saved.length > 0) {
        setUseFormula(true)
        setFormulaItems(saved)
      } else {
        setUseFormula(false)
        setFormulaItems([])
      }
    }
    setExpanded(!expanded)
  }

  const handleSave = async () => {
    // Save name if changed
    const trimmedName = editName.trim()
    if (trimmedName && trimmedName !== subcategoryName) {
      onRename(subcategoryId, trimmedName)
    }
    // Save plan data — await to ensure server persists before closing
    if (useFormula) {
      const serialized = serializeFormula(formulaItems)
      const total = calcFormulaTotal(formulaItems)
      await onSave(subcategoryId, total, recurring, serialized)
    } else {
      const trimmed = raw.replace(/,/g, '').trim()
      const num = trimmed ? parseInt(trimmed, 10) : 0
      await onSave(subcategoryId, isNaN(num) ? 0 : num, recurring, null)
    }
    setExpanded(false)
  }

  const updateItem = (index: number, updated: FormulaItem) => {
    const next = [...formulaItems]
    next[index] = updated
    setFormulaItems(next)
  }

  const removeItem = (index: number) => {
    const next = formulaItems.filter((_, i) => i !== index)
    setFormulaItems(next)
    if (next.length === 0) {
      setUseFormula(false)
    }
  }

  const addItem = () => {
    setFormulaItems([...formulaItems, { label: '', amount: 0, multiplier: 1 }])
  }

  const formulaTotal = calcFormulaTotal(formulaItems)

  return (
    <div className="py-1.5 border-b border-[#1e1e2a] last:border-0">
      {/* Collapsed row */}
      <div className="flex items-center gap-2">
        <span
          onClick={handleExpand}
          className={`text-sm flex-1 truncate cursor-pointer transition-colors ${
            expanded ? 'text-amber-400' : 'text-[#8b8b9e] hover:text-[#c4c4d4]'
          }`}
          title="クリックで編集"
        >
          {subcategoryName}
        </span>
        {hasFormula && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 border border-violet-500/30 shrink-0">
            fx
          </span>
        )}
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
            isRecurring ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-[#1a1a2e] text-[#5a5a6e] border border-[#2a2a3a]'
          }`}
        >
          {isRecurring ? '毎月' : '単月'}
        </span>
        <span className="text-sm font-mono text-[#e4e4ec] w-24 text-right shrink-0">
          {fmt(currentAmount)}
        </span>
        <button
          onClick={() => onDelete(subcategoryId)}
          className="text-[#3a3a4a] hover:text-red-400 transition-colors shrink-0 text-sm leading-none"
          title="削除"
        >
          ×
        </button>
      </div>
      {/* Expanded edit panel */}
      {expanded && (
        <div className="mt-2 ml-2 bg-[#0e0e14] rounded-xl border border-amber-500/20 px-4 py-3 space-y-3">
          {/* Name */}
          <div>
            <label className="text-[10px] text-[#5a5a6e] block mb-1">名前</label>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-sm text-white placeholder-[#3a3a4a] focus:border-amber-500/50 focus:outline-none transition-colors"
            />
          </div>
          {/* Mode selector */}
          <div>
            <label className="text-[10px] text-[#5a5a6e] block mb-1">入力方式</label>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  if (useFormula) {
                    const total = calcFormulaTotal(formulaItems)
                    setRaw(String(total))
                  }
                  setUseFormula(false)
                }}
                className={`text-[10px] px-2.5 py-1 rounded transition-colors ${
                  !useFormula
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'bg-[#1a1a2e] text-[#5a5a6e] border border-[#2a2a3a] hover:text-[#8b8b9e]'
                }`}
              >
                直接入力
              </button>
              <button
                onClick={() => {
                  if (!useFormula) {
                    const saved = parseFormula(currentFormula)
                    setFormulaItems(saved.length > 0 ? saved : [{ label: '', amount: 0, multiplier: 1 }])
                  }
                  setUseFormula(true)
                }}
                className={`text-[10px] px-2.5 py-1 rounded transition-colors ${
                  useFormula
                    ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30'
                    : 'bg-[#1a1a2e] text-[#5a5a6e] border border-[#2a2a3a] hover:text-[#8b8b9e]'
                }`}
              >
                計算式
              </button>
            </div>
          </div>
          {/* Input area */}
          {useFormula ? (
            <div>
              {formulaItems.map((item, i) => (
                <FormulaRow
                  key={i}
                  item={item}
                  onChange={updated => updateItem(i, updated)}
                  onRemove={() => removeItem(i)}
                />
              ))}
              {formulaItems.length > 1 && (
                <div className="flex items-center justify-between py-1 border-t border-violet-500/10 mt-0.5">
                  <span className="text-[10px] text-violet-400 font-semibold">合計</span>
                  <span className="text-xs font-mono text-violet-300 font-semibold">{fmt(formulaTotal)}</span>
                </div>
              )}
              <button
                onClick={addItem}
                className="text-[10px] text-[#5a5a6e] hover:text-violet-400 transition-colors py-1"
              >
                + 項目追加
              </button>
            </div>
          ) : (
            <div>
              <label className="text-[10px] text-[#5a5a6e] block mb-1">金額</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#5a5a6e]">¥</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={raw}
                  onChange={e => setRaw(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg pl-6 pr-3 py-1.5 text-sm text-right text-white placeholder-[#3a3a4a] focus:border-amber-500/50 focus:outline-none transition-colors"
                />
              </div>
            </div>
          )}
          {/* Footer: recurring + save */}
          <div className="flex items-center justify-between pt-1 border-t border-[#2a2a3a]">
            <button
              onClick={() => setRecurring(r => r ? 0 : 1)}
              className={`text-[10px] px-2 py-1 rounded transition-colors ${
                recurring ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-[#1a1a2e] text-[#5a5a6e] border border-[#2a2a3a]'
              }`}
            >
              {recurring ? '毎月' : '単月'}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setExpanded(false)}
                className="text-[10px] px-3 py-1 rounded bg-[#1a1a2e] text-[#5a5a6e] border border-[#2a2a3a] hover:text-[#8b8b9e] transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                className="text-[10px] px-3 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors font-semibold"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BudgetPlanTab({ yearMonth }: { yearMonth: string }) {
  const { data: categories, loading: catLoading, refetch: refetchCategories } = useApi<BudgetCategory[]>('/api/budget-mgmt/categories')
  const { data: plans, refetch: refetchPlans } = useApi<BudgetPlan[]>(`/api/budget-mgmt/plans/${yearMonth}`)
  const { data: income, refetch: refetchIncome } = useApi<BudgetIncome>(`/api/budget-mgmt/income/${yearMonth}`)
  const { data: pointTypes, refetch: refetchPointTypes } = useApi<PointType[]>('/api/budget-mgmt/point-types')
  const { data: pointBalances, refetch: refetchPointBalances } = useApi<PointBalanceV2[]>(`/api/budget-mgmt/point-balances/${yearMonth}`)
  const { data: wishItems } = useApi<WishItemForPlan[]>('/api/wish-items?type=wish')

  const [incomeRaw, setIncomeRaw] = useState('')
  const [incomeRecurring, setIncomeRecurring] = useState(1)
  const [savingsRaw, setSavingsRaw] = useState('')
  // Keyed by point_type_id
  const [pointDrafts, setPointDrafts] = useState<Record<number, { balance: string; selected_rate_option_id: number | null }>>({})
  // Point type management UI state
  const [addingPointType, setAddingPointType] = useState(false)
  const [newPointName, setNewPointName] = useState('')
  const [editingRatesFor, setEditingRatesFor] = useState<number | null>(null)
  const [newRateLabel, setNewRateLabel] = useState('')
  const [newRateValue, setNewRateValue] = useState('')
  const [addingTo, setAddingTo] = useState<number | null>(null)
  const [newSubName, setNewSubName] = useState('')
  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!pointTypes) return
    const drafts: typeof pointDrafts = {}
    for (const pt of pointTypes) {
      const saved = pointBalances?.find(p => p.point_type_id === pt.id)
      drafts[pt.id] = {
        balance: saved ? String(saved.balance) : '',
        selected_rate_option_id: saved?.selected_rate_option_id ?? (pt.rate_options[0]?.id ?? null),
      }
    }
    setPointDrafts(drafts)
  }, [pointTypes, pointBalances])

  useEffect(() => {
    if (income) {
      setIncomeRaw(income.amount ? String(income.amount) : '')
      setIncomeRecurring(income.is_recurring)
      setSavingsRaw(income.savings_target ? String(income.savings_target) : '')
    }
  }, [income])

  const planMap = new Map<number, BudgetPlan>()
  plans?.forEach(p => planMap.set(p.subcategory_id, p))

  const savePlan = useCallback(async (subcategoryId: number, amount: number, isRecurring: number, formula?: string | null) => {
    await apiPut(`/api/budget-mgmt/plans/${yearMonth}`, {
      plans: [{ subcategory_id: subcategoryId, amount, is_recurring: isRecurring, formula: formula ?? null }],
    })
    refetchPlans()
  }, [yearMonth, refetchPlans])

  const saveIncome = useCallback(async () => {
    const trimmed = incomeRaw.replace(/,/g, '').trim()
    const amount = trimmed ? parseInt(trimmed, 10) : 0
    if (isNaN(amount)) return
    const savingsTrimmed = savingsRaw.replace(/,/g, '').trim()
    const savingsTarget = savingsTrimmed ? parseInt(savingsTrimmed, 10) : 0
    await apiPut(`/api/budget-mgmt/income/${yearMonth}`, { amount, is_recurring: incomeRecurring, savings_target: isNaN(savingsTarget) ? 0 : savingsTarget })
    refetchIncome()
  }, [yearMonth, incomeRaw, savingsRaw, incomeRecurring, refetchIncome])

  const savePoints = useCallback(async (overrideDrafts?: typeof pointDrafts) => {
    const source = overrideDrafts ?? pointDrafts
    const balances = Object.entries(source).map(([id, d]) => ({
      point_type_id: Number(id),
      balance: parseInt(d.balance.replace(/,/g, '') || '0', 10) || 0,
      selected_rate_option_id: d.selected_rate_option_id,
    }))
    await apiPut(`/api/budget-mgmt/point-balances/${yearMonth}`, { balances })
    refetchPointBalances()
  }, [yearMonth, pointDrafts, refetchPointBalances])

  // Point type CRUD
  const addPointType = async () => {
    if (!newPointName.trim()) return
    await apiPost('/api/budget-mgmt/point-types', { name: newPointName.trim() })
    setNewPointName('')
    setAddingPointType(false)
    refetchPointTypes()
  }
  const deletePointType = async (id: number) => {
    if (!confirm('このポイント種別を削除しますか？関連する残高・レートも削除されます。')) return
    await apiDelete(`/api/budget-mgmt/point-types/${id}`)
    refetchPointTypes()
    refetchPointBalances()
  }
  const addRateOption = async (ptId: number) => {
    const rate = parseFloat(newRateValue)
    if (!newRateLabel.trim() || isNaN(rate)) return
    await apiPost(`/api/budget-mgmt/point-types/${ptId}/rate-options`, { label: newRateLabel.trim(), rate })
    setNewRateLabel('')
    setNewRateValue('')
    refetchPointTypes()
  }
  const deleteRateOption = async (id: number) => {
    await apiDelete(`/api/budget-mgmt/rate-options/${id}`)
    refetchPointTypes()
  }

  const copyPrevious = async () => {
    await apiPost(`/api/budget-mgmt/plans/${yearMonth}/copy-previous`, {})
    await apiPost(`/api/budget-mgmt/income/${yearMonth}/copy-previous`, {})
    refetchPlans()
    refetchIncome()
  }

  const addSubcategory = async (categoryId: number) => {
    if (!newSubName.trim()) return
    await apiPost('/api/budget-mgmt/subcategories', { category_id: categoryId, name: newSubName.trim() })
    setNewSubName('')
    setAddingTo(null)
    refetchCategories()
  }

  const deleteSubcategory = useCallback(async (subcategoryId: number) => {
    await apiDelete(`/api/budget-mgmt/subcategories/${subcategoryId}`)
    refetchCategories()
    refetchPlans()
  }, [refetchCategories, refetchPlans])

  const renameSubcategory = useCallback(async (subcategoryId: number, name: string) => {
    await apiPut(`/api/budget-mgmt/subcategories/${subcategoryId}`, { name })
    refetchCategories()
  }, [refetchCategories])

  // Auto-pick wish items by deadline in budget month range (must be before early return)
  const plannedItems = useMemo(() => {
    if (!wishItems) return []
    const [y, m] = yearMonth.split('-').map(Number)
    const from = `${y}-${String(m).padStart(2, '0')}-15`
    const nextM = m === 12 ? 1 : m + 1
    const nextY = m === 12 ? y + 1 : y
    const to = `${nextY}-${String(nextM).padStart(2, '0')}-14`
    return wishItems.filter(i => !i.done && i.deadline && i.deadline >= from && i.deadline <= to)
  }, [wishItems, yearMonth])

  // Helper: get rate for a point type from draft
  const getRateForDraft = useCallback((ptId: number): number => {
    const d = pointDrafts[ptId]
    if (!d) return 1
    const pt = pointTypes?.find(p => p.id === ptId)
    const opt = pt?.rate_options.find(o => o.id === d.selected_rate_option_id)
    return opt?.rate ?? 1
  }, [pointDrafts, pointTypes])

  // Helper: get point yen balance for a specific point type
  const getPointYenBalance = useCallback((ptId: number): number => {
    const d = pointDrafts[ptId]
    if (!d) return 0
    const b = parseInt(d.balance.replace(/,/g, '') || '0', 10) || 0
    return Math.floor(b * getRateForDraft(ptId))
  }, [pointDrafts, getRateForDraft])

  // Group planned items by payment method for summary
  const groupedPlanned = useMemo(() => {
    const groups = new Map<string, { label: string; items: WishItemForPlan[]; total: number }>()
    const labelOf = (pm: string): string => {
      if (pm === 'cash') return '現金'
      if (pm === 'loan') return 'ローン'
      if (pm.startsWith('point:')) {
        const id = Number(pm.slice(6))
        const pt = pointTypes?.find(p => p.id === id)
        return pt ? pt.name : 'ポイント'
      }
      return '現金'
    }
    for (const item of plannedItems) {
      const key = item.payment_method || 'cash'
      const g = groups.get(key) ?? { label: labelOf(key), items: [], total: 0 }
      g.items.push(item)
      g.total += item.price ?? 0
      groups.set(key, g)
    }
    return groups
  }, [plannedItems, pointTypes])

  const toggleCat = (catId: number) => {
    setExpandedCats(prev => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  if (catLoading) return <div className="text-[#5a5a6e] text-sm py-8 text-center">読み込み中...</div>

  const totalBudget = plans?.reduce((sum, p) => sum + p.amount, 0) ?? 0
  const savingsTarget = (income?.amount ?? 0) - totalBudget

  // Purchase power calculation
  const surplusBudget = savingsTarget - (income?.savings_target ?? 0)
  const pointYenTotal = Object.keys(pointDrafts).reduce((sum, id) => sum + getPointYenBalance(Number(id)), 0)
  const purchasePower = surplusBudget + pointYenTotal

  const fixedTotal = categories?.filter(c => c.type === 'fixed')
    .reduce((sum, cat) => sum + cat.subcategories.reduce((s, sub) => s + (planMap.get(sub.id)?.amount ?? 0), 0), 0) ?? 0
  const variableTotal = categories?.filter(c => c.type === 'variable')
    .reduce((sum, cat) => sum + cat.subcategories.reduce((s, sub) => s + (planMap.get(sub.id)?.amount ?? 0), 0), 0) ?? 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left column: Summary + Income + Points + Purchase power */}
      <div className="space-y-4">
      {/* Summary */}
      <div className="bg-[#16161e] rounded-2xl border border-[#2a2a3a] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#2a2a3a] flex items-center justify-between bg-gradient-to-r from-amber-500/8 from-[#16161e]">
          <span className="text-sm font-semibold text-[#e4e4ec]">サマリー</span>
          <button
            onClick={copyPrevious}
            className="text-[10px] px-2 py-1 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-colors"
          >
            前月からコピー
          </button>
        </div>
        <div className="px-5 py-1">
          <div className="flex items-center justify-between py-2 border-b border-[#1e1e2a]">
            <span className="text-sm text-[#8b8b9e]">収入</span>
            <span className="text-sm font-mono text-[#e4e4ec]">{fmt(income?.amount ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#1e1e2a]">
            <span className="text-sm text-[#8b8b9e]">固定費</span>
            <span className="text-sm font-mono text-[#e4e4ec]">{fmt(fixedTotal)}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#1e1e2a]">
            <span className="text-sm text-[#8b8b9e]">変動費</span>
            <span className="text-sm font-mono text-[#e4e4ec]">{fmt(variableTotal)}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#1e1e2a]">
            <span className="text-sm text-[#8b8b9e]">支出予算合計</span>
            <span className="text-sm font-mono text-[#e4e4ec]">{fmt(totalBudget)}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#1e1e2a]">
            <span className="text-sm text-[#8b8b9e]">貯金可能額</span>
            <span className={`text-sm font-mono font-bold ${savingsTarget >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>
              {fmt(savingsTarget)}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#1e1e2a]">
            <span className="text-sm text-[#8b8b9e]">貯金額</span>
            <span className="text-sm font-mono text-[#e4e4ec]">{fmt(income?.savings_target ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-semibold text-[#e4e4ec]">余剰予算</span>
            <span className={`text-sm font-mono font-bold ${(savingsTarget - (income?.savings_target ?? 0)) >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>
              {fmt(savingsTarget - (income?.savings_target ?? 0))}
            </span>
          </div>
        </div>
      </div>

      {/* Income */}
      <div className="bg-[#16161e] rounded-2xl border border-[#2a2a3a] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#2a2a3a] bg-gradient-to-r from-emerald-500/8 from-[#16161e]">
          <span className="text-sm font-semibold text-[#e4e4ec]">収入</span>
        </div>
        <div className="px-5">
          <div className="flex items-center gap-2 py-2.5">
            <span className="text-sm text-[#8b8b9e] flex-1">手取り収入</span>
            <button
              onClick={() => {
                const next = incomeRecurring ? 0 : 1
                setIncomeRecurring(next)
              }}
              className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 transition-colors ${
                incomeRecurring ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-[#1a1a2e] text-[#5a5a6e] border border-[#2a2a3a]'
              }`}
            >
              {incomeRecurring ? '毎月' : '単月'}
            </button>
            <div className="relative shrink-0">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-[#5a5a6e]">¥</span>
              <input
                type="text"
                inputMode="numeric"
                value={incomeRaw}
                onChange={e => setIncomeRaw(e.target.value)}
                onBlur={saveIncome}
                placeholder="0"
                className="w-28 bg-[#0e0e12] border border-[#2a2a3a] rounded-lg pl-5 pr-2 py-1 text-sm text-right text-white placeholder-[#3a3a4a] focus:border-emerald-500/50 focus:outline-none transition-colors"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 py-2.5 border-t border-[#1e1e2a]">
            <span className="text-sm text-[#8b8b9e] flex-1">貯金額</span>
            <div className="relative shrink-0">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-[#5a5a6e]">¥</span>
              <input
                type="text"
                inputMode="numeric"
                value={savingsRaw}
                onChange={e => setSavingsRaw(e.target.value)}
                onBlur={saveIncome}
                placeholder="0"
                className="w-28 bg-[#0e0e12] border border-[#2a2a3a] rounded-lg pl-5 pr-2 py-1 text-sm text-right text-white placeholder-[#3a3a4a] focus:border-amber-500/50 focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Point balances */}
      <div className="bg-[#16161e] rounded-2xl border border-[#2a2a3a] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#2a2a3a] bg-gradient-to-r from-violet-500/8 from-[#16161e] flex items-center justify-between">
          <span className="text-sm font-semibold text-[#e4e4ec]">ポイント資産</span>
          <button
            onClick={() => setAddingPointType(true)}
            className="text-[10px] px-2 py-1 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors"
          >
            + 追加
          </button>
        </div>
        <div className="px-5">
          {addingPointType && (
            <div className="flex items-center gap-2 py-2.5 border-b border-[#1e1e2a]">
              <input
                type="text"
                value={newPointName}
                onChange={e => setNewPointName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPointType()}
                placeholder="ポイント名"
                autoFocus
                className="flex-1 bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-1 text-sm text-white placeholder-[#3a3a4a] focus:border-violet-500/50 focus:outline-none"
              />
              <button onClick={addPointType} className="text-xs px-2 py-1 rounded bg-violet-500/15 text-violet-400 border border-violet-500/30 hover:bg-violet-500/25 transition-colors">追加</button>
              <button onClick={() => { setAddingPointType(false); setNewPointName('') }} className="text-xs text-[#5a5a6e] hover:text-white">×</button>
            </div>
          )}
          {(!pointTypes || pointTypes.length === 0) && !addingPointType && (
            <div className="py-4 text-center text-xs text-[#5a5a6e]">
              「+ 追加」からポイント種別を登録してください
            </div>
          )}
          {pointTypes?.map(pt => {
            const draft = pointDrafts[pt.id]
            if (!draft) return null
            const balanceNum = parseInt(draft.balance.replace(/,/g, '') || '0', 10) || 0
            const yenValue = getPointYenBalance(pt.id)
            const isEditingRates = editingRatesFor === pt.id
            return (
              <div key={pt.id} className="py-2.5 border-b border-[#1e1e2a] last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#8b8b9e] flex-1">{pt.name}</span>
                  <button
                    onClick={() => setEditingRatesFor(isEditingRates ? null : pt.id)}
                    className="text-[9px] px-1.5 py-0.5 rounded border bg-[#1a1a2e] text-[#5a5a6e] border-[#2a2a3a] hover:text-violet-400 hover:border-violet-500/30"
                  >
                    {isEditingRates ? '閉じる' : 'レート'}
                  </button>
                  <button
                    onClick={() => deletePointType(pt.id)}
                    className="text-[9px] text-[#5a5a6e] hover:text-red-400"
                  >×</button>
                  {pt.rate_options.length > 1 && (
                    <select
                      value={draft.selected_rate_option_id ?? ''}
                      onChange={e => {
                        const optId = Number(e.target.value)
                        setPointDrafts(prev => {
                          const next = { ...prev, [pt.id]: { ...prev[pt.id], selected_rate_option_id: optId } }
                          savePoints(next)
                          return next
                        })
                      }}
                      className="bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-1.5 py-1 text-[10px] text-[#e4e4ec] focus:outline-none focus:border-violet-500/50 cursor-pointer"
                    >
                      {pt.rate_options.map(o => (
                        <option key={o.id} value={o.id}>{o.label} ({o.rate}円/pt)</option>
                      ))}
                    </select>
                  )}
                  <div className="relative shrink-0">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={draft.balance}
                      onChange={e => setPointDrafts(prev => ({ ...prev, [pt.id]: { ...prev[pt.id], balance: e.target.value } }))}
                      onBlur={() => savePoints()}
                      placeholder="0"
                      className="w-24 bg-[#0e0e12] border border-[#2a2a3a] rounded-lg pr-7 pl-2 py-1 text-sm text-right text-white placeholder-[#3a3a4a] focus:border-violet-500/50 focus:outline-none transition-colors"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#5a5a6e]">pt</span>
                  </div>
                  {balanceNum > 0 && (
                    <span className="text-xs font-mono text-violet-300 shrink-0 w-16 text-right">{fmt(yenValue)}</span>
                  )}
                </div>
                {isEditingRates && (
                  <div className="mt-2 pl-2 border-l-2 border-violet-500/20 space-y-1">
                    {pt.rate_options.map(o => (
                      <div key={o.id} className="flex items-center gap-2 text-xs">
                        <span className="text-[#c0c0d0] flex-1">{o.label}</span>
                        <span className="text-[#8b8b9e] font-mono">{o.rate} 円/pt</span>
                        <button onClick={() => deleteRateOption(o.id)} className="text-[#5a5a6e] hover:text-red-400 text-xs">×</button>
                      </div>
                    ))}
                    <div className="flex items-center gap-1 pt-1">
                      <input
                        type="text"
                        value={newRateLabel}
                        onChange={e => setNewRateLabel(e.target.value)}
                        placeholder="ラベル"
                        className="flex-1 bg-[#0e0e12] border border-[#2a2a3a] rounded px-2 py-0.5 text-[11px] text-white focus:border-violet-500/50 focus:outline-none"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={newRateValue}
                        onChange={e => setNewRateValue(e.target.value)}
                        placeholder="1.0"
                        className="w-14 bg-[#0e0e12] border border-[#2a2a3a] rounded px-2 py-0.5 text-[11px] text-right text-white focus:border-violet-500/50 focus:outline-none"
                      />
                      <button
                        onClick={() => addRateOption(pt.id)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20"
                      >+</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Purchase power */}
      <div className="bg-[#16161e] rounded-2xl border border-[#2a2a3a] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#2a2a3a] bg-gradient-to-r from-amber-500/8 from-[#16161e]">
          <span className="text-sm font-semibold text-[#e4e4ec]">購入可能額</span>
        </div>
        <div className="px-5 py-1">
          <div className="flex items-center justify-between py-2 border-b border-[#1e1e2a]">
            <span className="text-sm text-[#8b8b9e]">余剰予算</span>
            <span className="text-xs font-mono text-[#e4e4ec]">{fmt(surplusBudget)}</span>
          </div>
          {pointYenTotal > 0 && (
            <div className="flex items-center justify-between py-2 border-b border-[#1e1e2a]">
              <span className="text-sm text-[#8b8b9e]">ポイント資産</span>
              <span className="text-xs font-mono text-violet-300">{fmt(pointYenTotal)}</span>
            </div>
          )}
          <div className="flex items-center justify-between py-2 border-b border-[#1e1e2a]">
            <span className="text-sm font-semibold text-[#e4e4ec]">購入可能額</span>
            <span className={`text-sm font-mono font-bold ${purchasePower >= 0 ? 'text-amber-300' : 'text-red-400'}`}>
              {fmt(purchasePower)}
            </span>
          </div>
          {plannedItems.length > 0 && (
            <div className="mt-2 space-y-2">
              <div className="text-[10px] text-[#5a5a6e]">今月の購入予定（支払方法別）</div>
              {[...groupedPlanned.entries()].map(([key, g]) => {
                const isPoint = key.startsWith('point:')
                const isLoan = key === 'loan'
                const color = isPoint ? 'text-violet-300' : isLoan ? 'text-sky-300' : 'text-[#e4e4ec]'
                return (
                  <div key={key} className="bg-[#0e0e12]/50 rounded-lg px-2 py-1.5 border border-[#1e1e2a]">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[11px] font-semibold ${color}`}>{g.label}</span>
                      <span className={`text-xs font-mono ${color}`}>{fmt(g.total)}</span>
                    </div>
                    {g.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between py-0.5">
                        <span className="text-xs text-[#c0c0d0] truncate flex-1">{item.title}</span>
                        <span className="text-[10px] text-[#5a5a6e] shrink-0 ml-2">{item.deadline?.slice(5).replace('-', '/')}</span>
                        <span className="text-xs font-mono text-[#8b8b9e] shrink-0 ml-2 w-16 text-right">{item.price ? fmt(item.price) : '—'}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
          {(() => {
            // Calculate remaining by excluding loan from subtraction
            const nonLoanTotal = [...groupedPlanned.entries()]
              .filter(([key]) => key !== 'loan')
              .reduce((sum, [, g]) => sum + g.total, 0)
            const remaining = purchasePower - nonLoanTotal
            return (
              <div className="flex items-center justify-between py-2.5 border-t border-[#2a2a3a] mt-2">
                <span className="text-sm font-semibold text-[#e4e4ec]">残り購入可能額</span>
                <span className={`text-sm font-mono font-bold ${remaining >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>
                  {fmt(remaining)}
                </span>
              </div>
            )
          })()}
        </div>
      </div>
      </div>

      {/* Right column: Category sections */}
      <div className="space-y-4">
      {['fixed', 'variable'].map(type => (
        <div key={type}>
          <h3 className="text-xs font-bold text-[#5a5a6e] uppercase tracking-wider mb-2 px-1">
            {type === 'fixed' ? '固定費' : '変動費'}
          </h3>
          <div className="space-y-3">
            {categories?.filter(c => c.type === type).map(cat => {
              const catTotal = cat.subcategories.reduce((sum, sub) => sum + (planMap.get(sub.id)?.amount ?? 0), 0)
              const isExpanded = expandedCats.has(cat.id)
              return (
                <div key={cat.id} className="bg-[#16161e] rounded-2xl border border-[#2a2a3a] overflow-hidden">
                  <button
                    onClick={() => toggleCat(cat.id)}
                    className="w-full px-5 py-2.5 flex items-center justify-between hover:bg-[#1a1a2e] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] text-[#5a5a6e] transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                      <span className="text-sm font-semibold text-[#e4e4ec]">{cat.name}</span>
                    </div>
                    <span className="text-sm font-mono text-[#e4e4ec]">{fmt(catTotal)}</span>
                  </button>
                  <div className={`px-5 border-t border-[#2a2a3a] ${isExpanded ? '' : 'hidden'}`}>
                      {cat.subcategories.map(sub => {
                        const plan = planMap.get(sub.id)
                        return (
                          <PlanInput
                            key={sub.id}
                            subcategoryId={sub.id}
                            subcategoryName={sub.name}
                            currentAmount={plan?.amount ?? 0}
                            isRecurring={plan?.is_recurring ?? 1}
                            currentFormula={plan?.formula ?? null}
                            onSave={savePlan}
                            onDelete={deleteSubcategory}
                            onRename={renameSubcategory}
                          />
                        )
                      })}
                      <div className="flex items-center gap-2 py-2 border-t border-[#1e1e2a]">
                        {addingTo === cat.id ? (
                          <>
                            <input
                              type="text"
                              value={newSubName}
                              onChange={e => setNewSubName(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && addSubcategory(cat.id)}
                              placeholder="サブカテゴリ名"
                              autoFocus
                              className="flex-1 bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-1 text-sm text-white placeholder-[#3a3a4a] focus:border-amber-500/50 focus:outline-none"
                            />
                            <button
                              onClick={() => addSubcategory(cat.id)}
                              className="text-xs px-2 py-1 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
                            >
                              追加
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setAddingTo(cat.id)}
                            className="text-xs text-[#5a5a6e] hover:text-amber-400 transition-colors"
                          >
                            + サブカテゴリ追加
                          </button>
                        )}
                      </div>
                    </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      </div>
    </div>
  )
}
