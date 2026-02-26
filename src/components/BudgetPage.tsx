import { useState, useEffect, useCallback } from 'react'
import { useApi } from '../hooks/useApi'

interface BudgetEntry {
  year_month: string
  au_pay: number | null
  mufg_billing: number | null
  jcb_billing: number | null
  minsin_balance: number | null
  mufg_balance: number | null
  jcb_skip: number
}

// ── Helpers ──

function currentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-')
  return `${y}年${Number(m)}月`
}

function fmt(v: number | null): string {
  if (v === null || v === undefined) return '—'
  return `¥${v.toLocaleString()}`
}

function n(v: number | null): number {
  return v ?? 0
}

// ── Input field ──

function AmountInput({
  label,
  value,
  onChange,
  placeholder = '未入力',
  accent = 'emerald',
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  accent?: 'emerald' | 'sky' | 'violet' | 'amber'
}) {
  const [raw, setRaw] = useState(value !== null ? String(value) : '')

  useEffect(() => {
    setRaw(value !== null ? String(value) : '')
  }, [value])

  const accentMap = {
    emerald: 'focus:border-emerald-500/50',
    sky: 'focus:border-sky-500/50',
    violet: 'focus:border-violet-500/50',
    amber: 'focus:border-amber-500/50',
  }

  const handleBlur = () => {
    const trimmed = raw.replace(/,/g, '').trim()
    if (trimmed === '' || trimmed === '-') {
      onChange(null)
      setRaw('')
    } else {
      const n = parseInt(trimmed, 10)
      if (!isNaN(n)) {
        onChange(n)
        setRaw(String(n))
      }
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-[#1e1e2a] last:border-0">
      <span className="text-sm text-[#8b8b9e] shrink-0">{label}</span>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#5a5a6e]">¥</span>
        <input
          type="text"
          inputMode="numeric"
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`w-36 bg-[#0e0e12] border border-[#2a2a3a] rounded-lg pl-6 pr-3 py-1.5 text-sm text-right text-white placeholder-[#3a3a4a] ${accentMap[accent]} focus:outline-none transition-colors`}
        />
      </div>
    </div>
  )
}

// ── Calculated row ──

function CalcRow({
  label,
  value,
  highlight = false,
  alert = false,
  muted = false,
}: {
  label: string
  value: number | null
  highlight?: boolean
  alert?: boolean
  muted?: boolean
}) {
  const textColor = alert && value !== null && value < 0
    ? 'text-red-400'
    : highlight
      ? 'text-emerald-300 font-bold'
      : muted
        ? 'text-[#5a5a6e]'
        : 'text-[#e4e4ec]'

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#1e1e2a] last:border-0">
      <span className="text-sm text-[#8b8b9e]">{label}</span>
      <span className={`text-sm font-mono tabular-nums ${textColor}`}>
        {value === null ? '—' : fmt(value)}
      </span>
    </div>
  )
}

// ── Section card ──

function Section({
  title,
  icon,
  accent,
  children,
}: {
  title: string
  icon: React.ReactNode
  accent: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-[#16161e] rounded-2xl border border-[#2a2a3a] overflow-hidden">
      <div className={`px-5 py-3 border-b border-[#2a2a3a] flex items-center gap-2 bg-gradient-to-r ${accent} from-[#16161e]`}>
        {icon}
        <span className="text-sm font-semibold text-[#e4e4ec]">{title}</span>
      </div>
      <div className="px-5">{children}</div>
    </div>
  )
}

// ── Main page ──

export default function BudgetPage() {
  const [yearMonth, setYearMonth] = useState(currentYearMonth())
  const { data: entry, refetch } = useApi<BudgetEntry>(`/api/budget/${yearMonth}`)

  // Local editable state (synced from server)
  const [form, setForm] = useState<BudgetEntry>({
    year_month: yearMonth,
    au_pay: null,
    mufg_billing: null,
    jcb_billing: null,
    minsin_balance: null,
    mufg_balance: null,
    jcb_skip: 0,
  })
  const [saving, setSaving] = useState(false)

  // Sync form from fetched data
  useEffect(() => {
    if (entry) {
      setForm({ ...entry })
    } else {
      setForm({
        year_month: yearMonth,
        au_pay: null,
        mufg_billing: null,
        jcb_billing: null,
        minsin_balance: null,
        mufg_balance: null,
        jcb_skip: 0,
      })
    }
  }, [entry, yearMonth])

  const save = useCallback(async (updated: BudgetEntry) => {
    setSaving(true)
    try {
      await fetch(`/api/budget/${yearMonth}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      refetch()
    } finally {
      setSaving(false)
    }
  }, [yearMonth, refetch])

  const setField = (field: keyof BudgetEntry, value: number | null) => {
    const updated = { ...form, [field]: value }
    setForm(updated)
    save(updated)
  }

  // ── Calculations ──
  const totalBilling = n(form.au_pay) + n(form.mufg_billing) + n(form.jcb_billing)
  const totalBalance = n(form.minsin_balance) + n(form.mufg_balance)
  const adjustment = totalBalance - totalBilling          // positive = surplus; negative = shortfall
  const jcbActual = n(form.jcb_billing) - n(form.jcb_skip)
  const finalBilling = n(form.au_pay) + n(form.mufg_billing) + jcbActual
  const surplus = totalBalance - finalBilling

  // Show null when all inputs are null (no data yet)
  const hasAnyInput = form.au_pay !== null || form.mufg_billing !== null || form.jcb_billing !== null
  const hasBalance = form.minsin_balance !== null || form.mufg_balance !== null

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-[#2a2a3a] -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 pt-1 bg-gradient-to-r from-emerald-500/8 to-transparent">
        <h1 className="text-2xl font-bold text-white tracking-wide mb-1">家計簿</h1>
        <p className="text-sm text-[#5a5a6e]">月次の支払い管理</p>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-6 bg-[#0a0a10] rounded-2xl px-4 py-2.5 border border-[#1e1e2a]">
        <button
          onClick={() => setYearMonth(m => shiftMonth(m, -1))}
          className="px-3 py-1.5 text-[#5a5a6e] hover:text-[#e4e4ec] transition-colors text-lg leading-none"
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-white">{formatYearMonth(yearMonth)}</span>
          {yearMonth !== currentYearMonth() && (
            <button
              onClick={() => setYearMonth(currentYearMonth())}
              className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
            >
              今月
            </button>
          )}
          {saving && <span className="text-[10px] text-[#5a5a6e] animate-pulse">保存中...</span>}
        </div>
        <button
          onClick={() => setYearMonth(m => shiftMonth(m, 1))}
          className="px-3 py-1.5 text-[#5a5a6e] hover:text-[#e4e4ec] transition-colors text-lg leading-none"
        >
          ›
        </button>
      </div>

      <div className="grid gap-4">
        {/* ── Section 1: 請求額 ── */}
        <Section
          title="請求額"
          accent="from-sky-500/8"
          icon={
            <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
            </svg>
          }
        >
          <AmountInput label="Au Pay" value={form.au_pay} onChange={v => setField('au_pay', v)} accent="sky" />
          <AmountInput label="MUFG" value={form.mufg_billing} onChange={v => setField('mufg_billing', v)} accent="sky" />
          <AmountInput label="JCB" value={form.jcb_billing} onChange={v => setField('jcb_billing', v)} accent="sky" />
          <CalcRow label="合計請求額" value={hasAnyInput ? totalBilling : null} muted />
        </Section>

        {/* ── Section 2: 口座残高 ── */}
        <Section
          title="口座残高"
          accent="from-emerald-500/8"
          icon={
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        >
          <AmountInput label="口座（みん銀）" value={form.minsin_balance} onChange={v => setField('minsin_balance', v)} accent="emerald" />
          <AmountInput label="口座（MUFG）" value={form.mufg_balance} onChange={v => setField('mufg_balance', v)} accent="emerald" />
          <CalcRow label="総額" value={hasBalance ? totalBalance : null} muted />
        </Section>

        {/* ── Section 3: JCB スキップ調整 ── */}
        <Section
          title="JCBスキップ調整"
          accent="from-violet-500/8"
          icon={
            <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          }
        >
          <CalcRow
            label="要調整額"
            value={hasAnyInput && hasBalance ? adjustment : null}
            alert
          />
          <AmountInput
            label="スキップ金額"
            value={form.jcb_skip || null}
            onChange={v => setField('jcb_skip', v ?? 0)}
            placeholder="0"
            accent="violet"
          />
          <CalcRow label="JCB 実請求額" value={form.jcb_billing !== null ? jcbActual : null} muted />
        </Section>

        {/* ── Section 4: 最終決済額 ── */}
        <Section
          title="最終決済額"
          accent="from-amber-500/8"
          icon={
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        >
          <CalcRow label="請求額" value={hasAnyInput ? finalBilling : null} />
          <CalcRow label="口座残高" value={hasBalance ? totalBalance : null} />
          <CalcRow
            label="余剰金額"
            value={hasAnyInput && hasBalance ? surplus : null}
            highlight={surplus >= 0}
            alert={surplus < 0}
          />
        </Section>

        {/* ── 要調整額が負の場合の警告 ── */}
        {hasAnyInput && hasBalance && adjustment < 0 && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-500/8 border border-red-500/20 rounded-xl">
            <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-300">口座残高が不足しています</p>
              <p className="text-xs text-red-400/70 mt-0.5">
                {fmt(Math.abs(adjustment))} 分のJCBスキップが必要です
              </p>
            </div>
          </div>
        )}

        {/* ── 余剰金額が正の場合の確認 ── */}
        {hasAnyInput && hasBalance && surplus >= 0 && (
          <div className="flex items-start gap-3 px-4 py-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
            <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-emerald-300">支払い可能です</p>
              <p className="text-xs text-emerald-400/70 mt-0.5">
                {fmt(surplus)} の余剰があります
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
