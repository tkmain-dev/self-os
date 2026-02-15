import { useState } from 'react'
import { useApi, apiPost, apiPatch, apiDelete } from '../hooks/useApi'

interface Todo {
  id: number
  title: string
  done: number
  due_date: string | null
  created_at: string
}

export default function TodoList() {
  const { data: todos, loading, refetch } = useApi<Todo[]>('/api/todos')
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    await apiPost('/api/todos', { title: title.trim(), due_date: dueDate || null })
    setTitle('')
    setDueDate('')
    refetch()
  }

  const handleToggle = async (todo: Todo) => {
    await apiPatch(`/api/todos/${todo.id}`, { done: !todo.done })
    refetch()
  }

  const handleDelete = async (id: number) => {
    await apiDelete(`/api/todos/${id}`)
    refetch()
  }

  if (loading) return <p className="text-stone-400">読み込み中...</p>

  return (
    <div className="max-w-2xl">
      <h2 className="techo-heading text-2xl mb-5">TODO</h2>

      <form onSubmit={handleAdd} className="flex gap-2 mb-6">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="新しいタスク..."
          className="flex-1 bg-white/80 border border-stone-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        />
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          className="bg-white/80 border border-stone-300 rounded px-3 py-2"
        />
        <button
          type="submit"
          className="bg-stone-700 text-white px-4 py-2 rounded hover:bg-stone-800 text-sm"
        >
          追加
        </button>
      </form>

      <ul className="space-y-1">
        {todos?.map(todo => (
          <li
            key={todo.id}
            className={`flex items-center gap-3 rounded px-3 py-2.5 border-b border-stone-200/60 ${
              todo.done ? 'opacity-50' : ''
            }`}
          >
            <button
              onClick={() => handleToggle(todo)}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                todo.done
                  ? 'bg-stone-500 border-stone-500 text-white'
                  : 'border-stone-400 hover:border-amber-600'
              }`}
            >
              {todo.done ? '✓' : ''}
            </button>
            <span className={`flex-1 ${todo.done ? 'line-through text-stone-400' : 'text-stone-700'}`}>
              {todo.title}
            </span>
            {todo.due_date && (
              <span className="text-xs text-stone-400 tabular-nums">{todo.due_date}</span>
            )}
            <button
              onClick={() => handleDelete(todo.id)}
              className="text-stone-300 hover:text-red-500 text-sm"
            >
              &times;
            </button>
          </li>
        ))}
      </ul>

      {todos?.length === 0 && (
        <p className="text-stone-400 text-center mt-8 text-sm">タスクはありません</p>
      )}
    </div>
  )
}
