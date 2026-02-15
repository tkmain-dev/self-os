import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import DailyPage from './components/DailyPage'
import GoalGantt from './components/GoalGantt'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/daily" replace />} />
        <Route path="/daily" element={<DailyPage />} />
        <Route path="/goals" element={<GoalGantt />} />
      </Routes>
    </Layout>
  )
}

export default App
