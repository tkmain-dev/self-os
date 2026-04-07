export interface BudgetSubcategory {
  id: number
  category_id: number
  name: string
  sort_order: number
}

export interface BudgetCategory {
  id: number
  name: string
  type: 'fixed' | 'variable'
  sort_order: number
  subcategories: BudgetSubcategory[]
}

export interface BudgetPlan {
  id: number
  year_month: string
  subcategory_id: number
  amount: number
  is_recurring: number
  formula: string | null
  subcategory_name: string
  category_id: number
  category_name: string
  category_type: string
}

export interface BudgetIncome {
  year_month: string
  amount: number
  is_recurring: number
  savings_target: number
}

export interface BudgetActual {
  id: number
  year_month: string
  category_name: string
  subcategory_name: string
  date: string
  description: string
  amount: number
  source: string
  csv_id: string | null
}

export interface ActualSummary {
  category_name: string
  total: number
}

export interface PointBalance {
  id?: number
  year_month: string
  point_type: 'jcb_jpoint' | 'amazon' | 'welfare'
  balance: number
  exchange_rate: number
  exchange_label: string
}

export interface WishMonthPlan {
  id: number
  year_month: string
  wish_item_id: number
  title: string
  price: number | null
}

export interface BudgetAnalysis {
  overview: {
    score: number
    grade: string
    summary: string
  }
  categories: {
    name: string
    status: 'good' | 'warning' | 'over'
    analysis: string
    top_expenses: string[]
    trend: 'up' | 'down' | 'stable'
    trend_detail: string
  }[]
  insights: {
    type: 'warning' | 'positive' | 'tip'
    title: string
    detail: string
  }[]
  savings_tips: string[]
}

export interface PointRateOption {
  id: number
  point_type_id: number
  label: string
  rate: number
  sort_order: number
}

export interface PointType {
  id: number
  name: string
  sort_order: number
  rate_options: PointRateOption[]
}

export interface PointBalanceV2 {
  id?: number
  year_month: string
  point_type_id: number
  balance: number
  selected_rate_option_id: number | null
}

export type PaymentMethod = 'cash' | 'loan' | `point:${number}`
