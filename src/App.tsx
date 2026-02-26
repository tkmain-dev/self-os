import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import DailyPage from './components/DailyPage'
import CalendarPage from './components/calendar/CalendarPage'
import GoalGantt from './components/GoalGantt'
import WishListPage from './components/WishListPage'
import BudgetPage from './components/BudgetPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/daily" replace />} />
        <Route path="/daily" element={<DailyPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/goals" element={<GoalGantt />} />
        <Route path="/wishlist" element={<WishListPage />} />
        <Route path="/budget" element={<BudgetPage />} />
      </Routes>
    </Layout>
  )
}

export default App
