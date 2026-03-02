import { useState } from 'react'

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        onLogin()
      } else {
        setError('パスワードが正しくありません')
        setPassword('')
      }
    } catch {
      setError('接続エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[#0f0f1a]">
      <form onSubmit={handleSubmit} className="w-80 p-8 rounded-2xl bg-[#1a1a2e] shadow-2xl">
        <h1 className="text-2xl font-bold text-white mb-1 tracking-[0.25em] text-center">手 帳</h1>
        <div className="w-10 h-0.5 bg-amber-500 mx-auto mb-6" />

        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="パスワード"
          autoFocus
          className="w-full px-4 py-3 rounded-lg bg-[#16162a] border border-[#2a2a4a] text-white placeholder-[#555] focus:outline-none focus:border-amber-500 transition-colors"
        />

        {error && (
          <p className="text-red-400 text-sm mt-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full mt-4 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-medium transition-colors cursor-pointer"
        >
          {loading ? 'ログイン中...' : 'ログイン'}
        </button>
      </form>
    </div>
  )
}
