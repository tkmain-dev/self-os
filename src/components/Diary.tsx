import { useState, useEffect } from 'react'
import { apiPut } from '../hooks/useApi'

const formatDate = (d: Date) => d.toISOString().split('T')[0]

const dayNames = ['日', '月', '火', '水', '木', '金', '土']

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${dayNames[d.getDay()]}）`
}

export default function Diary() {
  const [date, setDate] = useState(formatDate(new Date()))
  const [content, setContent] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setSaved(false)
    fetch(`/api/diary/${date}`)
      .then(r => r.json())
      .then(d => { setContent(d.content || ''); setLoading(false); })
  }, [date])

  const handleSave = async () => {
    await apiPut(`/api/diary/${date}`, { content })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const changeDate = (offset: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + offset)
    setDate(formatDate(d))
  }

  return (
    <div className="max-w-2xl">
      <h2 className="techo-heading text-2xl mb-5">日記</h2>

      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => changeDate(-1)} className="px-3 py-1 bg-stone-200 rounded hover:bg-stone-300 text-stone-600">&larr;</button>
        <span className="text-lg font-medium min-w-[160px] text-center text-stone-700">{formatDateLabel(date)}</span>
        <button onClick={() => changeDate(1)} className="px-3 py-1 bg-stone-200 rounded hover:bg-stone-300 text-stone-600">&rarr;</button>
        <button
          onClick={() => setDate(formatDate(new Date()))}
          className="px-3 py-1 bg-amber-100 text-amber-800 rounded hover:bg-amber-200 text-sm"
        >
          今日
        </button>
      </div>

      {loading ? (
        <p className="text-stone-400">読み込み中...</p>
      ) : (
        <>
          <textarea
            value={content}
            onChange={e => { setContent(e.target.value); setSaved(false); }}
            placeholder="今日のことを書いてみよう..."
            className="w-full h-80 bg-white/70 border border-stone-300 rounded p-4 focus:outline-none focus:ring-2 focus:ring-amber-400/50 resize-none leading-8 text-stone-700"
            style={{
              backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #d4cdc2 31px, #d4cdc2 32px)',
              backgroundAttachment: 'local',
            }}
          />
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handleSave}
              className="bg-stone-700 text-white px-6 py-2 rounded hover:bg-stone-800 text-sm"
            >
              保存
            </button>
            {saved && <span className="text-amber-700 text-sm">保存しました</span>}
          </div>
        </>
      )}
    </div>
  )
}
