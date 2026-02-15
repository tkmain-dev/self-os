import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const today = () => {
  const d = new Date()
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`
}

const nav = [
  { to: '/daily', label: 'デイリー', icon: '▦' },
  { to: '/goals', label: '目標管理', icon: '◫' },
]

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen">
      <aside className="sidebar w-48 p-4 flex flex-col shadow-lg">
        <h1 className="text-xl font-bold mb-0.5 text-white tracking-widest">手 帳</h1>
        <div className="w-12 h-0.5 bg-amber-600 mb-2" />
        <p className="text-xs text-amber-200/70 mb-6 tracking-wide">{today()}</p>
        <nav className="flex flex-col gap-0.5">
          {nav.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="text-base">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto pt-4 border-t border-white/10">
          <p className="text-xs text-white/30 text-center">My Techo</p>
        </div>
      </aside>
      <main className="page-area flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}
