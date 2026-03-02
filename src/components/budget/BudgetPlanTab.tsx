import { useState, useEffect, useCallback } from 'react'
import { useApi, apiPut, apiPost, apiDelete } from '../../hooks/useApi'
import type { BudgetCategory, BudgetPlan, BudgetIncome } from './types'

function fmt(v: number): string {
  return `¥${Math.abs(v).toLocaleString()}`
}

function PlanInput({
  subcategoryId,
  subcategoryName,
  currentAmount,
  isRecurring,
  onSave,
  onDelete,
}: {
  subcategoryId: number
  subcategoryName: string
  currentAmount: number
  isRecurring: number
  onSave: (subcategoryId: number, amount: number, isRecurring: number) => void
  onDelete: (subcategoryId: number) => void
}) {
  const [raw, setRaw] = useState(currentAmount ? String(currentAmount) : '')
  const [recurring, setRecurring] = useState(isRecurring)

  useEffect(() => {
    setRaw(currentAmount ? String(currentAmount) : '')
    setRecurring(isRecurring)
  }, [currentAmount, isRecurring])

  const handleBlur = () => {
    const trimmed = raw.replace(/,/g, '').trim()
    const num = trimmed ? parseInt(trimmed, 10) : 0
    if (!isNaN(num) && (num !== currentAmount || recurring !== isRecurring)) {
      onSave(subcategoryId, num, recurring)
    }
  }

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-[#1e1e2a] last:border-0">
      <span className="text-sm text-[#8b8b9e] flex-1 truncate">{subcategoryName}</span>
      <button
        onClick={() => {
          const next = recurring ? 0 : 1
          setRecurring(next)
          const num = raw.replace(/,/g, '').trim()
          const amount = num ? parseInt(num, 10) : 0
          if (!isNaN(amount)) onSave(subcategoryId, amount, next)
        }}
        className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 transition-colors ${
          recurring ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-[#1a1a2e] text-[#5a5a6e] border border-[#2a2a3a]'
        }`}
        title={recurring ? '毎月繰り返し' : '今月のみ'}
      >
        {recurring ? '毎月' : '単月'}
      </button>
      <div className="relative shrink-0">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-[#5a5a6e]">¥</span>
        <input
          type="text"
          inputMode="numeric"
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={handleBlur}
          placeholder="0"
          className="w-24 bg-[#0e0e12] border border-[#2a2a3a] rounded-lg pl-5 pr-2 py-1 text-sm text-right text-white placeholder-[#3a3a4a] focus:border-amber-500/50 focus:outline-none transition-colors"
        />
      </div>
      <button
        onClick={() => onDelete(subcategoryId)}
        className="text-[#3a3a4a] hover:text-red-400 transition-colors shrink-0 text-sm leading-none"
        title="削除"
      >
        ×
      </button>
    </div>
  )
}

export default function BudgetPlanTab({ yearMonth }: { yearMonth: string }) {
  const { data: categories, loading: catLoading, refetch: refetchCategories } = useApi<BudgetCategory[]>('/api/budget-mgmt/categories')
  const { data: plans, refetch: refetchPlans } = useApi<BudgetPlan[]>(`/api/budget-mgmt/plans/${yearMonth}`)
  const { data: income, refetch: refetchIncome } = useApi<BudgetIncome>(`/api/budget-mgmt/income/${yearMonth}`)

  const [incomeRaw, setIncomeRaw] = useState('')
  const [incomeRecurring, setIncomeRecurring] = useState(1)
  const [addingTo, setAddingTo] = useState<number | null>(null)
  const [newSubName, setNewSubName] = useState('')
  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (income) {
      setIncomeRaw(income.amount ? String(income.amount) : '')
      setIncomeRecurring(income.is_recurring)
    }
  }, [income])

  const planMap = new Map<number, BudgetPlan>()
  plans?.forEach(p => planMap.set(p.subcategory_id, p))

  const savePlan = useCallback(async (subcategoryId: number, amount: number, isRecurring: number) => {
    await apiPut(`/api/budget-mgmt/plans/${yearMonth}`, {
      plans: [{ subcategory_id: subcategoryId, amount, is_recurring: isRecurring }],
    })
    refetchPlans()
  }, [yearMonth, refetchPlans])

  const saveIncome = useCallback(async () => {
    const trimmed = incomeRaw.replace(/,/g, '').trim()
    const amount = trimmed ? parseInt(trimmed, 10) : 0
    if (isNaN(amount)) return
    await apiPut(`/api/budget-mgmt/income/${yearMonth}`, { amount, is_recurring: incomeRecurring })
    refetchIncome()
  }, [yearMonth, incomeRaw, incomeRecurring, refetchIncome])

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

  if (catLoading) return <div className="text-[#5a5a6e] text-sm py-8 text-center">読み込み中...</div>

  const totalBudget = plans?.reduce((sum, p) => sum + p.amount, 0) ?? 0
  const savingsTarget = (income?.amount ?? 0) - totalBudget

  const toggleCat = (catId: number) => {
    setExpandedCats(prev => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  // Compute type totals for summary
  const fixedTotal = categories?.filter(c => c.type === 'fixed')
    .reduce((sum, cat) => sum + cat.subcategories.reduce((s, sub) => s + (planMap.get(sub.id)?.amount ?? 0), 0), 0) ?? 0
  const variableTotal = categories?.filter(c => c.type === 'variable')
    .reduce((sum, cat) => sum + cat.subcategories.reduce((s, sub) => s + (planMap.get(sub.id)?.amount ?? 0), 0), 0) ?? 0

  return (
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
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-[#8b8b9e]">貯金可能額</span>
            <span className={`text-sm font-mono font-bold ${savingsTarget >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>
              {savingsTarget >= 0 ? '+' : '-'}{fmt(savingsTarget)}
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
        </div>
      </div>

      {/* Category sections */}
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
                  {isExpanded && (
                    <div className="px-5 border-t border-[#2a2a3a]">
                      {cat.subcategories.map(sub => {
                        const plan = planMap.get(sub.id)
                        return (
                          <PlanInput
                            key={sub.id}
                            subcategoryId={sub.id}
                            subcategoryName={sub.name}
                            currentAmount={plan?.amount ?? 0}
                            isRecurring={plan?.is_recurring ?? 1}
                            onSave={savePlan}
                            onDelete={deleteSubcategory}
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
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
