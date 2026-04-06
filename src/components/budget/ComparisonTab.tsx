import { useState, useCallback, useEffect } from 'react'
import { useApi, apiPost } from '../../hooks/useApi'
import type { BudgetCategory, BudgetPlan, BudgetIncome, ActualSummary, BudgetAnalysis } from './types'

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

// ── AI Analysis Panel ──

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const circumference = 2 * Math.PI * 42
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : score >= 40 ? '#f97316' : '#ef4444'
  return (
    <div className="relative w-28 h-28">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#1e1e2a" strokeWidth="6" />
        <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{grade}</span>
        <span className="text-xs text-[#8b8b9e]">{score}点</span>
      </div>
    </div>
  )
}

function AnalysisPanel({ analysis, onRerun, analyzing }: { analysis: BudgetAnalysis; onRerun: () => void; analyzing: boolean }) {
  const statusColors = {
    good: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: '良好' },
    warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', label: '注意' },
    over: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', label: '超過' },
  }
  const trendIcons = { up: '↑', down: '↓', stable: '→' }
  const trendColors = { up: 'text-red-400', down: 'text-emerald-400', stable: 'text-[#5a5a6e]' }
  const insightStyles = {
    warning: { bg: 'bg-amber-500/8', border: 'border-amber-500/20', icon: '⚠', iconColor: 'text-amber-400' },
    positive: { bg: 'bg-emerald-500/8', border: 'border-emerald-500/20', icon: '✓', iconColor: 'text-emerald-400' },
    tip: { bg: 'bg-sky-500/8', border: 'border-sky-500/20', icon: '💡', iconColor: 'text-sky-400' },
  }

  return (
    <div className="col-span-1 lg:col-span-2 space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500/10 via-sky-500/5 to-transparent rounded-2xl border border-violet-500/20 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
            </svg>
            <span className="text-sm font-bold text-white">AI 分析レポート</span>
          </div>
          <button
            onClick={onRerun}
            disabled={analyzing}
            className="text-[10px] px-2 py-1 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors disabled:opacity-50"
          >
            {analyzing ? '分析中...' : '再分析'}
          </button>
        </div>

        <div className="flex items-center gap-6">
          <ScoreRing score={analysis.overview.score} grade={analysis.overview.grade} />
          <p className="text-sm text-[#c0c0d0] flex-1 leading-relaxed">{analysis.overview.summary}</p>
        </div>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {analysis.categories.map(cat => {
          const s = statusColors[cat.status]
          return (
            <div key={cat.name} className={`${s.bg} border ${s.border} rounded-xl px-4 py-3`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-[#e4e4ec]">{cat.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.bg} ${s.text} font-medium`}>{s.label}</span>
              </div>
              <p className="text-[11px] text-[#8b8b9e] leading-relaxed">{cat.analysis}</p>
              {cat.top_expenses?.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {cat.top_expenses.map((exp, i) => (
                    <div key={i} className="text-[10px] text-[#c0c0d0] flex items-center gap-1">
                      <span className="text-[#5a5a6e]">{i + 1}.</span> {exp}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1 mt-1.5">
                <span className={`text-xs ${trendColors[cat.trend]}`}>{trendIcons[cat.trend]}</span>
                <span className="text-[10px] text-[#5a5a6e]">{cat.trend_detail || '前月比'}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Insights */}
      {analysis.insights.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-[#5a5a6e] uppercase tracking-wider px-1">分析インサイト</h4>
          {analysis.insights.map((ins, i) => {
            const s = insightStyles[ins.type]
            return (
              <div key={i} className={`${s.bg} border ${s.border} rounded-xl px-4 py-3`}>
                <div className="flex items-start gap-2">
                  <span className={`text-sm ${s.iconColor} shrink-0 mt-0.5`}>{s.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-[#e4e4ec]">{ins.title}</p>
                    <p className="text-xs text-[#8b8b9e] mt-0.5 leading-relaxed">{ins.detail}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Savings tips */}
      {analysis.savings_tips.length > 0 && (
        <div className="bg-[#16161e] rounded-2xl border border-[#2a2a3a] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#2a2a3a] bg-gradient-to-r from-emerald-500/8 from-[#16161e]">
            <span className="text-sm font-semibold text-[#e4e4ec]">節約提案</span>
          </div>
          <div className="px-5 py-3 space-y-2">
            {analysis.savings_tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-emerald-400 text-xs shrink-0 mt-0.5">{i + 1}.</span>
                <p className="text-sm text-[#c0c0d0] leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ComparisonTab({ yearMonth }: { yearMonth: string }) {
  const { data: categories } = useApi<BudgetCategory[]>('/api/budget-mgmt/categories')
  const { data: plans } = useApi<BudgetPlan[]>(`/api/budget-mgmt/plans/${yearMonth}`)
  const { data: income } = useApi<BudgetIncome>(`/api/budget-mgmt/income/${yearMonth}`)
  const { data: actualSummary } = useApi<ActualSummary[]>(`/api/budget-mgmt/actuals/${yearMonth}/summary`)

  const [analysis, setAnalysis] = useState<BudgetAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState('')

  // Load cached analysis on mount / yearMonth change
  useEffect(() => {
    setAnalysis(null)
    setAnalysisError('')
    fetch(`/api/budget-mgmt/analysis/${yearMonth}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (data?.overview) setAnalysis(data) })
      .catch(() => {})
  }, [yearMonth])

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true)
    setAnalysisError('')
    try {
      const result = await apiPost<BudgetAnalysis & { error?: string }>(`/api/budget-mgmt/analysis/${yearMonth}`, {})
      if (result.error) {
        setAnalysisError(result.error)
      } else if (!result.overview) {
        setAnalysisError('分析結果の形式が不正です')
      } else {
        setAnalysis(result)
      }
    } catch {
      setAnalysisError('分析に失敗しました')
    } finally {
      setAnalyzing(false)
    }
  }, [yearMonth])

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left column: Expense details */}
      <div className="space-y-4">
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

                  const catAnalysis = analysis?.categories.find(c => c.name === cat.name || c.name.startsWith(cat.name))

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
                      {catAnalysis && (
                        <div className={`mt-1.5 px-2 py-1.5 rounded-lg text-[11px] leading-relaxed ${
                          catAnalysis.status === 'over' ? 'bg-red-500/5 text-red-300/80'
                            : catAnalysis.status === 'warning' ? 'bg-amber-500/5 text-amber-300/80'
                            : 'bg-emerald-500/5 text-emerald-300/80'
                        }`}>
                          <p>{catAnalysis.analysis}</p>
                          {catAnalysis.top_expenses?.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {catAnalysis.top_expenses.map((exp, i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-black/20">{exp}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
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
      </div>

      {/* Right column: Income + Total summary */}
      <div className="space-y-4">
      {/* Income */}
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

      {/* AI Analysis (spans full width) */}
      <div className="col-span-1 lg:col-span-2">
        {!analysis ? (
          <div className="flex flex-col items-center py-6">
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                analyzing
                  ? 'bg-violet-500/10 text-violet-400/50 border border-violet-500/20 cursor-wait'
                  : 'bg-gradient-to-r from-violet-500/20 to-sky-500/20 text-white border border-violet-500/30 hover:from-violet-500/30 hover:to-sky-500/30 hover:shadow-lg hover:shadow-violet-500/10'
              }`}
            >
              {analyzing ? (
                <>
                  <span className="w-4 h-4 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
                  </svg>
                  AI分析を実行
                </>
              )}
            </button>
            {analysisError && <p className="text-red-400 text-xs mt-2">{analysisError}</p>}
          </div>
        ) : (
          <AnalysisPanel analysis={analysis} onRerun={runAnalysis} analyzing={analyzing} />
        )}
      </div>
    </div>
  )
}
