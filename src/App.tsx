import { useState, useEffect, Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import LoginPage from './components/LoginPage'

// Lazy-loaded pages — each becomes a separate chunk
const DailyPage = lazy(() => import('./components/DailyPage'))
const CalendarPage = lazy(() => import('./components/calendar/CalendarPage'))
const GoalGantt = lazy(() => import('./components/GoalGantt'))
const WishListPage = lazy(() => import('./components/WishListPage'))
const BudgetPage = lazy(() => import('./components/BudgetPage'))
const KptPage = lazy(() => import('./components/KptPage'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
    </div>
  )
}

function App() {
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')

  useEffect(() => {
    fetch('/api/auth/check', { credentials: 'include' })
      .then(res => {
        setAuthState(res.ok ? 'authenticated' : 'unauthenticated')
      })
      .catch(() => setAuthState('unauthenticated'))
  }, [])

  if (authState === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f0f1a]">
        <div className="text-[#8b8b9e]">読み込み中...</div>
      </div>
    )
  }

  if (authState === 'unauthenticated') {
    return <LoginPage onLogin={() => setAuthState('authenticated')} />
  }

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/daily" replace />} />
          <Route path="/daily" element={<DailyPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/goals" element={<GoalGantt />} />
          <Route path="/wishlist" element={<WishListPage />} />
          <Route path="/budget" element={<BudgetPage />} />
          <Route path="/kpt" element={<KptPage />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}

export default App
