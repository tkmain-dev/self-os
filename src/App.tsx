import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import DailyPage from './components/DailyPage'
import CalendarPage from './components/calendar/CalendarPage'
import GoalGantt from './components/GoalGantt'
import WishListPage from './components/WishListPage'
import BudgetPage from './components/BudgetPage'
import KptPage from './components/KptPage'
import LoginPage from './components/LoginPage'

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
      <Routes>
        <Route path="/" element={<Navigate to="/daily" replace />} />
        <Route path="/daily" element={<DailyPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/goals" element={<GoalGantt />} />
        <Route path="/wishlist" element={<WishListPage />} />
        <Route path="/budget" element={<BudgetPage />} />
        <Route path="/kpt" element={<KptPage />} />
      </Routes>
    </Layout>
  )
}

export default App
