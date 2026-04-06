import { useApi } from '../../hooks/useApi'
import type { BudgetCategory, BudgetPlan, BudgetIncome, ActualSummary } from './types'

function fmt(v: number): string {
  if (v >= 0) return `¥${v.toLocaleString()}`
  return `-¥${Math.abs(v).toLocaleString()}`
}

function DiffBadge({ diff }: { diff: number }) {
  if (diff === 0) return null
  // diff > 0 means under budget (good), diff < 0 means over budget (bad)
  const isGood = diff > 0
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
      isGood ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
    }`}>
      {isGood ? '+' : ''}{fmt(diff)}
    </span>
  )
}

function ProgressBar({ budget, actual }: { budget: number; actual: number }) {
  if (budget === 0) return null
  const pct = Math.min(Math.abs(actual) / budget * 100, 150)
  const over = pct > 100
  return (
    <div className="w-full h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden mt-1">
      <div
        className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : 'bg-emerald-500/60'}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  )
}

export default function ComparisonTab({ yearMonth }: { yearMonth: string }) {
  const { data: categories } = useApi<BudgetCategory[]>('/api/budget-mgmt/categories')
  const { data: plans } = useApi<BudgetPlan[]>(`/api/budget-mgmt/plans/${yearMonth}`)
  const { data: income } = useApi<BudgetIncome>(`/api/budget-mgmt/income/${yearMonth}`)
  const { data: actualSummary } = useApi<ActualSummary[]>(`/api/budget-mgmt/actuals/${yearMonth}/summary`)

  if (!categories || !plans || !actualSummary) {
    return <div className="text-[#5a5a6e] text-sm py-8 text-center">読み込み中...</div>
  }

  // Build plan totals by category
  const planByCategory = new Map<string, number>()
  plans.forEach(p => {
    const cat = p.category_name
    planByCategory.set(cat, (planByCategory.get(cat) ?? 0) + p.amount)
  })

  // Build actual totals by category (amounts are negative for expenses)
  const actualByCategory = new Map<string, number>()
  actualSummary.forEach(a => {
    actualByCategory.set(a.category_name, a.total)
  })

  // All category names (union of plan + actual)
  const allCatNames = new Set([...planByCategory.keys(), ...actualByCategory.keys()])

  const incomeAmount = income?.amount ?? 0
  const actualIncome = actualByCategory.get('収入') ?? 0

  // Total budget (expenses only, exclude income)
  const totalBudget = plans.reduce((sum, p) => sum + p.amount, 0)
  const totalActual = actualSummary
    .filter(a => a.category_name !== '収入')
    .reduce((sum, a) => sum + a.total, 0)

  const savingsTarget = income?.savings_target ?? 0
  const savingsBudget = incomeAmount - totalBudget
  const savingsActual = (actualIncome || incomeAmount) + totalActual // totalActual is negative
  const surplusBudget = savingsBudget - savingsTarget
  const surplusActual = savingsActual - savingsTarget

  // Remove income from comparison rows
  allCatNames.delete('収入')
  // Remove non-expense categories
  allCatNames.delete('現金・カード')

  return (
    <div className="space-y-4">
      {/* Income row */}
      <div className="bg-[#16161e] rounded-2xl border border-[#2a2a3a] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#2a2a3a] bg-gradient-to-r from-emerald-500/8 from-[#16161e]">
          <span className="text-sm font-semibold text-[#e4e4ec]">収入</span>
        </div>
        <div className="px-5 py-2">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-[#8b8b9e]">予算</span>
            <span className="text-sm font-mono text-[#e4e4ec]">{fmt(incomeAmount)}</span>
          </div>
          {actualIncome > 0 && (
            <div className="flex items-center justify-between py-2 border-t border-[#1e1e2a]">
              <span className="text-sm text-[#8b8b9e]">実績</span>
              <span className="text-sm font-mono text-emerald-400">{fmt(actualIncome)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Expense comparison by type */}
      {['fixed', 'variable'].map(type => {
        const typeCats = categories.filter(c => c.type === type)
        const relevantCats = typeCats.filter(c => allCatNames.has(c.name))
        if (relevantCats.length === 0 && !typeCats.some(c => planByCategory.has(c.name))) return null

        return (
          <div key={type}>
            <h3 className="text-xs font-bold text-[#5a5a6e] uppercase tracking-wider mb-2 px-1">
              {type === 'fixed' ? '固定費' : '変動費'}
            </h3>
            <div className="bg-[#16161e] rounded-2xl border border-[#2a2a3a] overflow-hidden">
              <div className="px-5">
                {typeCats.map(cat => {
                  const budget = planByCategory.get(cat.name) ?? 0
                  const actual = Math.abs(actualByCategory.get(cat.name) ?? 0)
                  if (budget === 0 && actual === 0) return null

                  const diff = budget - actual

                  return (
                    <div key={cat.id} className="py-2.5 border-b border-[#1e1e2a] last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-[#e4e4ec] flex-1">{cat.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-[#5a5a6e] font-mono w-20 text-right">{budget ? fmt(budget) : '—'}</span>
                          <span className={`text-xs font-mono w-20 text-right ${actual > budget && budget > 0 ? 'text-red-400' : 'text-[#e4e4ec]'}`}>
                            {actual ? fmt(actual) : '—'}
                          </span>
                          <div className="w-20 text-right">
                            {(budget > 0 || actual > 0) && <DiffBadge diff={diff} />}
                          </div>
                        </div>
                      </div>
                      {budget > 0 && <ProgressBar budget={budget} actual={actual} />}
                    </div>
                  )
                })}

                {/* Unmatched categories from actuals */}
                {[...allCatNames].filter(name => !typeCats.some(c => c.name === name)).length > 0 && type === 'variable' && (
                  [...allCatNames]
                    .filter(name => !categories.some(c => c.name === name))
                    .map(name => {
                      const actual = Math.abs(actualByCategory.get(name) ?? 0)
                      if (actual === 0) return null
                      return (
                        <div key={name} className="py-2.5 border-b border-[#1e1e2a] last:border-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-[#e4e4ec] flex-1">{name} <span className="text-[10px] text-[#5a5a6e]">未設定</span></span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-[#5a5a6e] font-mono w-20 text-right">—</span>
                              <span className="text-xs font-mono w-20 text-right text-[#e4e4ec]">{fmt(actual)}</span>
                              <div className="w-20" />
                            </div>
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* Total summary */}
      <div className="bg-[#16161e] rounded-2xl border border-[#2a2a3a] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#2a2a3a] bg-gradient-to-r from-amber-500/8 from-[#16161e]">
          <span className="text-sm font-semibold text-[#e4e4ec]">合計</span>
        </div>
        <div className="px-5 py-1">
          {/* Header */}
          <div className="flex items-center justify-between py-2 border-b border-[#1e1e2a]">
            <span className="text-sm text-[#5a5a6e]"></span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-[#5a5a6e] w-20 text-right">予算</span>
              <span className="text-[10px] text-[#5a5a6e] w-20 text-right">実績</span>
              <span className="text-[10px] text-[#5a5a6e] w-20 text-right">差異</span>
            </div>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#1e1e2a]">
            <span className="text-sm text-[#8b8b9e]">支出合計</span>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-[#e4e4ec] w-20 text-right">{fmt(totalBudget)}</span>
              <span className="text-xs font-mono text-[#e4e4ec] w-20 text-right">{fmt(Math.abs(totalActual))}</span>
              <div className="w-20 text-right">
                <DiffBadge diff={totalBudget - Math.abs(totalActual)} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#1e1e2a]">
            <span className="text-sm text-[#8b8b9e]">貯金可能額</span>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-mono w-20 text-right ${savingsBudget >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>
                {fmt(savingsBudget)}
              </span>
              <span className={`text-xs font-mono w-20 text-right ${savingsActual >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>
                {fmt(savingsActual)}
              </span>
              <div className="w-20 text-right">
                <DiffBadge diff={savingsActual - savingsBudget} />
              </div>
            </div>
          </div>
          {savingsTarget > 0 && (
            <div className="flex items-center justify-between py-2 border-b border-[#1e1e2a]">
              <span className="text-sm text-[#8b8b9e]">貯金額</span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-[#e4e4ec] w-20 text-right">{fmt(savingsTarget)}</span>
                <span className="text-xs font-mono text-[#e4e4ec] w-20 text-right">{fmt(savingsTarget)}</span>
                <div className="w-20" />
              </div>
            </div>
          )}
          <div className="flex items-center justify-between py-2.5">
            <span className="text-sm font-semibold text-[#e4e4ec]">余剰予算</span>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-mono font-bold w-20 text-right ${surplusBudget >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>
                {fmt(surplusBudget)}
              </span>
              <span className={`text-sm font-mono font-bold w-20 text-right ${surplusActual >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>
                {fmt(surplusActual)}
              </span>
              <div className="w-20 text-right">
                <DiffBadge diff={surplusActual - surplusBudget} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
