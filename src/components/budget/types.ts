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
