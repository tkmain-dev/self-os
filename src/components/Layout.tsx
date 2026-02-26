import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import AdminModal, { GearButton } from './admin/AdminModal'

const today = () => {
  const d = new Date()
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`
}

const nav = [
  { to: '/daily', label: 'デイリー', icon: '▦' },
  { to: '/calendar', label: 'カレンダー', icon: '▨' },
  { to: '/goals', label: '目標管理', icon: '◫' },
  { to: '/wishlist', label: 'ウィッシュ', icon: '✦' },
  { to: '/budget', label: '家計簿', icon: '¥' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const [adminOpen, setAdminOpen] = useState(false)

  return (
    <div className="flex h-screen">
      {/* ── Desktop sidebar ── */}
      <aside className="sidebar w-52 p-5 flex-col shadow-2xl hidden md:flex">
        <h1 className="text-xl font-bold mb-0.5 text-white tracking-[0.25em]">手 帳</h1>
        <div className="w-10 h-0.5 bg-amber-500 mb-2" />
        <p className="text-xs text-[#8b8b9e] mb-8 tracking-wide">{today()}</p>
        <nav className="flex flex-col gap-1">
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
        <div className="mt-auto pt-4 border-t border-[#2a2a3a] flex items-center justify-between">
          <p className="text-xs text-[#5a5a6e]">My Techo</p>
          <GearButton onClick={() => setAdminOpen(true)} />
        </div>
      </aside>

      {/* ── Mobile top header ── */}
      <div className="mobile-header md:hidden">
        <h1 className="text-base font-bold text-white tracking-[0.2em]">手 帳</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8b8b9e]">{today()}</span>
          <button
            onClick={() => window.location.reload()}
            className="group p-2 rounded-lg hover:bg-[#1e1e2a] transition-all duration-300"
            title="更新"
          >
            <svg className="w-5 h-5 text-[#5a5a6e] group-hover:text-amber-500 transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
          <GearButton onClick={() => setAdminOpen(true)} />
        </div>
      </div>

      {/* ── Main content ── */}
      <main className="page-area flex-1 overflow-auto p-4 md:p-6 lg:p-8 pt-[52px] pb-[64px] md:pt-4 md:pb-4">
        {children}
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="mobile-bottom-nav md:hidden">
        {nav.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="text-lg leading-none">{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <AdminModal open={adminOpen} onClose={() => setAdminOpen(false)} />
    </div>
  )
}
