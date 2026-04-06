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

export const POINT_TYPES = {
  jcb_jpoint: {
    label: 'JCB J-POINT',
    options: [
      { label: 'MyJCB Pay', rate: 1.0 },
      { label: 'JCBギフトカード', rate: 1.0 },
      { label: 'カード支払い充当', rate: 0.7 },
      { label: 'Amazon利用', rate: 0.7 },
      { label: '他社ポイント交換', rate: 0.7 },
    ],
  },
  amazon: {
    label: 'Amazonポイント',
    options: [{ label: 'Amazonポイント', rate: 1.0 }],
  },
  welfare: {
    label: '福利厚生ポイント',
    options: [{ label: '福利厚生ポイント', rate: 1.0 }],
  },
} as const
