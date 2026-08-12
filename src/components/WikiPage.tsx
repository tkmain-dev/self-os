import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi, apiPost, apiPatch, apiDelete } from '../hooks/useApi'
import DatePicker from './DatePicker'
import type { PartialBlock } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/mantine'
import { useCreateBlockNote } from '@blocknote/react'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'

interface WikiPageMeta {
  id: number
  parent_id: number | null
  title: string
  sort_order: number
  updated_at: string
}

interface TreeNode extends WikiPageMeta {
  children: TreeNode[]
}

function buildTree(pages: WikiPageMeta[]): TreeNode[] {
  const map = new Map<number, TreeNode>()
  pages.forEach(p => map.set(p.id, { ...p, children: [] }))
  const roots: TreeNode[] = []
  for (const node of map.values()) {
    if (node.parent_id !== null && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

// ── Image upload for BlockNote ──

async function uploadImage(file: File): Promise<string> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const res = await apiPost<{ url: string; error?: string }>('/api/wiki/images', { data: base64, mime: file.type })
  if (res.error || !res.url) throw new Error(res.error ?? 'upload failed')
  return res.url
}

// ── Tree item ──

function TreeItem({
  node, depth, selectedId, expanded, onSelect, onToggle, onAddChild, onDelete,
}: {
  node: TreeNode
  depth: number
  selectedId: number | null
  expanded: Set<number>
  onSelect: (id: number) => void
  onToggle: (id: number) => void
  onAddChild: (parentId: number) => void
  onDelete: (id: number, title: string) => void
}) {
  const isOpen = expanded.has(node.id)
  const hasChildren = node.children.length > 0
  const isSelected = selectedId === node.id

  return (
    <div>
      <div
        className={`group flex items-center gap-1 px-1.5 py-1 cursor-pointer transition-colors border-l-2 ${
          isSelected
            ? 'border-sky-400 bg-sky-500/8 text-white font-medium'
            : 'border-transparent text-[#9b9bae] hover:text-white hover:bg-[#1e1e2a]'
        }`}
        style={{ paddingLeft: `${6 + depth * 14}px` }}
        onClick={() => onSelect(node.id)}
      >
        <button
          onClick={e => { e.stopPropagation(); onToggle(node.id) }}
          className={`w-4 shrink-0 text-[10px] text-[#5a5a6e] hover:text-white transition-transform ${isOpen ? 'rotate-90' : ''} ${hasChildren ? '' : 'opacity-0'}`}
        >
          ▶
        </button>
        <span className="text-sm truncate flex-1">{node.title || '無題'}</span>
        <button
          onClick={e => { e.stopPropagation(); onAddChild(node.id) }}
          className="opacity-0 group-hover:opacity-100 text-[#5a5a6e] hover:text-sky-400 text-sm px-0.5 shrink-0"
          title="子ページを追加"
        >
          +
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(node.id, node.title) }}
          className="opacity-0 group-hover:opacity-100 text-[#5a5a6e] hover:text-red-400 text-xs px-0.5 shrink-0"
          title="削除"
        >
          ×
        </button>
      </div>
      {isOpen && node.children.map(child => (
        <TreeItem
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          expanded={expanded}
          onSelect={onSelect}
          onToggle={onToggle}
          onAddChild={onAddChild}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

// ── Table of contents ──

interface TocItem {
  id: string
  level: number
  text: string
}

function extractToc(blocks: unknown[]): TocItem[] {
  const items: TocItem[] = []
  const walk = (list: unknown[]) => {
    for (const b of list) {
      const block = b as { id: string; type: string; props?: { level?: number }; content?: unknown; children?: unknown[] }
      if (block.type === 'heading') {
        const text = Array.isArray(block.content)
          ? (block.content as { text?: string }[]).map(c => c.text ?? '').join('')
          : ''
        items.push({ id: block.id, level: block.props?.level ?? 1, text })
      }
      if (Array.isArray(block.children) && block.children.length > 0) walk(block.children)
    }
  }
  walk(blocks)
  return items
}

// ── Editor pane (remounted per page via key) ──

function WikiEditor({ pageId, ancestors, onTitleChanged, onDeleted, onNavigate }: {
  pageId: number
  ancestors: { id: number; title: string }[]
  onTitleChanged: () => void
  onDeleted: () => void
  onNavigate: (id: number | null) => void
}) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [updatedAt, setUpdatedAt] = useState('')
  const [links, setLinks] = useState<string[]>([])
  const [initialContent, setInitialContent] = useState<PartialBlock[] | undefined>(undefined)
  const [hasChanges, setHasChanges] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [newLinkDate, setNewLinkDate] = useState('')
  const [toc, setToc] = useState<TocItem[]>([])
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useCreateBlockNote({
    initialContent,
    uploadFile: uploadImage,
  })

  // Load page
  useEffect(() => {
    setLoading(true)
    fetch(`/api/wiki/pages/${pageId}`, { credentials: 'include' })
      .then(r => {
        if (!r.ok) { onDeleted(); throw new Error('not found') }
        return r.json()
      })
      .then(d => {
        setTitle(d.title)
        setUpdatedAt(d.updated_at ?? '')
        setLinks(d.links ?? [])
        try {
          setInitialContent(d.content ? (JSON.parse(d.content) as PartialBlock[]) : [{ type: 'paragraph', content: '' }])
        } catch {
          setInitialContent([{ type: 'paragraph', content: '' }])
        }
        setLoading(false)
      })
      .catch(() => {})
  }, [pageId, onDeleted])

  useEffect(() => {
    if (!loading && initialContent && editor) {
      editor.replaceBlocks(editor.document, initialContent)
      setHasChanges(false)
      setToc(extractToc(editor.document))
    }
  }, [initialContent, loading, editor])

  useEffect(() => {
    if (editor && !loading) {
      editor.onChange(() => {
        setHasChanges(true)
        setSaved(false)
        setToc(extractToc(editor.document))
      })
    }
  }, [editor, loading])

  const scrollToBlock = (blockId: string) => {
    const el = document.querySelector(`[data-id="${blockId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const saveContent = useCallback(async () => {
    try {
      await apiPatch(`/api/wiki/pages/${pageId}`, { content: JSON.stringify(editor.document) })
      setSaved(true)
      setHasChanges(false)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      alert('保存に失敗しました')
    }
  }, [pageId, editor])

  // Auto-save after 5s
  useEffect(() => {
    if (!hasChanges || loading) return
    const timer = setTimeout(saveContent, 5000)
    return () => clearTimeout(timer)
  }, [hasChanges, loading, saveContent])

  // Title auto-save (debounced 800ms)
  const handleTitleChange = (v: string) => {
    setTitle(v)
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(async () => {
      await apiPatch(`/api/wiki/pages/${pageId}`, { title: v })
      onTitleChanged()
    }, 800)
  }

  const addLink = async () => {
    if (!newLinkDate) return
    await apiPost(`/api/wiki/pages/${pageId}/links`, { date: newLinkDate })
    setLinks(prev => prev.includes(newLinkDate) ? prev : [...prev, newLinkDate].sort().reverse())
    setNewLinkDate('')
    setShowDatePicker(false)
  }

  const removeLink = async (date: string) => {
    await apiDelete(`/api/wiki/pages/${pageId}/links/${date}`)
    setLinks(prev => prev.filter(d => d !== date))
  }

  if (loading) return <div className="text-[#5a5a6e] text-sm py-8 text-center">読み込み中...</div>

  return (
    <div className="flex gap-6 items-start">
    <div className="flex flex-col flex-1 min-w-0">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs mb-4 flex-wrap">
        <button onClick={() => onNavigate(null)} className="text-sky-400 hover:text-sky-300 hover:underline transition-colors">
          Wiki
        </button>
        {ancestors.map(a => (
          <span key={a.id} className="flex items-center gap-1.5">
            <span className="text-[#4a4a5e]">/</span>
            <button onClick={() => onNavigate(a.id)} className="text-sky-400 hover:text-sky-300 hover:underline transition-colors">
              {a.title || '無題'}
            </button>
          </span>
        ))}
        <span className="text-[#4a4a5e]">/</span>
        <span className="text-[#8b8b9e]">{title || '無題'}</span>
      </nav>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={e => handleTitleChange(e.target.value)}
        placeholder="無題"
        className="w-full bg-transparent text-[2rem] leading-tight font-bold text-white placeholder-[#3a3a4a] focus:outline-none px-1"
      />

      {/* Meta + gradient rule */}
      {updatedAt && (
        <div className="text-[11px] text-[#5a5a6e] mt-1.5 px-1">
          最終更新: {updatedAt.slice(0, 16).replace('T', ' ')}
        </div>
      )}
      <div className="h-px mt-3 mb-5 bg-gradient-to-r from-sky-500/60 via-violet-500/30 to-transparent" />

      {/* Editor — flat document style (no card frame) */}
      <div className="wiki-editor flex-1 min-h-[300px]">
        <BlockNoteView editor={editor} theme="dark" />
      </div>

      {/* Save status */}
      <div className="flex items-center gap-3 mt-2 min-h-[20px]">
        {saved && <span className="text-sky-400 text-xs">保存しました</span>}
        {hasChanges && !saved && (
          <button onClick={saveContent} className="text-xs text-[#8b8b9e] hover:text-sky-400 transition-colors">
            未保存の変更があります — クリックで保存
          </button>
        )}
      </div>

      {/* Diary links */}
      <div className="mt-3 pt-3 border-t border-[#2a2a3a]">
        <div className="text-[10px] text-[#5a5a6e] mb-1.5">関連する日記</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {links.map(date => (
            <span key={date} className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs">
              <button onClick={() => navigate(`/daily?date=${date}`)} className="hover:underline">
                {date.slice(5).replace('-', '/')}
              </button>
              <button onClick={() => removeLink(date)} className="text-sky-500/50 hover:text-red-400">×</button>
            </span>
          ))}
          {showDatePicker ? (
            <span className="inline-flex items-center gap-1">
              <DatePicker value={newLinkDate} onChange={setNewLinkDate} placeholder="日付を選択" accentColor="amber" className="w-36" />
              <button onClick={addLink} disabled={!newLinkDate} className="text-xs px-2 py-1 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-40 transition-colors">追加</button>
              <button onClick={() => { setShowDatePicker(false); setNewLinkDate('') }} className="text-xs text-[#5a5a6e] hover:text-white">×</button>
            </span>
          ) : (
            <button
              onClick={() => setShowDatePicker(true)}
              className="text-xs px-2 py-0.5 rounded-full border border-dashed border-[#3a3a4e] text-[#5a5a6e] hover:text-amber-400 hover:border-amber-500/40 transition-colors"
            >
              + 日付追加
            </button>
          )}
        </div>
      </div>
    </div>

    {/* Table of contents (desktop only, sticky) */}
    {toc.length > 0 && (
      <div className="hidden lg:block w-48 shrink-0 sticky top-4">
        <div className="text-[11px] text-[#8b8b9e] font-semibold mb-2 px-2 uppercase tracking-wider">このページの内容</div>
        <div className="border-l border-[#2a2a3a] space-y-0.5">
          {toc.map(item => (
            <button
              key={item.id}
              onClick={() => scrollToBlock(item.id)}
              className="block w-full text-left text-xs text-[#8b8b9e] hover:text-sky-400 hover:border-l-2 hover:border-sky-400 hover:-ml-px truncate py-1 transition-colors"
              style={{ paddingLeft: `${8 + (item.level - 1) * 12}px` }}
              title={item.text}
            >
              {item.text || '(空の見出し)'}
            </button>
          ))}
        </div>
      </div>
    )}
    </div>
  )
}

// ── Main page ──

export default function WikiPage() {
  const { data: pages, refetch } = useApi<WikiPageMeta[]>('/api/wiki/pages')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const tree = useMemo(() => buildTree(pages ?? []), [pages])

  // Ancestor chain for breadcrumb
  const ancestors = useMemo(() => {
    if (selectedId === null || !pages) return []
    const byId = new Map(pages.map(p => [p.id, p]))
    const chain: { id: number; title: string }[] = []
    let cur = byId.get(selectedId)
    while (cur && cur.parent_id !== null) {
      const parent = byId.get(cur.parent_id)
      if (!parent) break
      chain.unshift({ id: parent.id, title: parent.title })
      cur = parent
    }
    return chain
  }, [selectedId, pages])

  const toggle = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const createPage = async (parentId: number | null) => {
    const page = await apiPost<WikiPageMeta>('/api/wiki/pages', { title: '無題', parent_id: parentId })
    if (parentId !== null) setExpanded(prev => new Set(prev).add(parentId))
    await refetch()
    setSelectedId(page.id)
  }

  const deletePage = async (id: number, title: string) => {
    if (!confirm(`「${title || '無題'}」を削除しますか？子ページも一緒に削除されます。`)) return
    await apiDelete(`/api/wiki/pages/${id}`)
    if (selectedId === id) setSelectedId(null)
    refetch()
  }

  const handleDeleted = useCallback(() => setSelectedId(null), [])

  return (
    <div className="w-full max-w-[1800px] mx-auto">
      <div className="mb-4 pb-4 border-b border-[#2a2a3a] bg-gradient-to-r from-sky-500/8 to-transparent -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 pt-1">
        <h1 className="text-2xl font-bold text-white tracking-wide mb-1">Wiki</h1>
        <p className="text-sm text-[#5a5a6e]">知識・記録を整理する</p>
      </div>

      <div className="flex gap-5 items-start">
        {/* Tree sidebar (hidden on mobile when a page is selected, sticky on desktop) */}
        <div className={`w-full md:w-60 shrink-0 md:sticky md:top-4 ${selectedId !== null ? 'hidden md:block' : ''}`}>
          <button
            onClick={() => createPage(null)}
            className="w-full mb-3 px-3 py-1.5 text-sm rounded-lg bg-gradient-to-r from-sky-500/15 to-violet-500/10 text-sky-300 border border-sky-500/30 hover:from-sky-500/25 hover:to-violet-500/20 transition-colors"
          >
            + 新規ページ
          </button>
          <div className="text-[11px] text-[#8b8b9e] font-semibold mb-1.5 px-2 uppercase tracking-wider">ページ</div>
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            {tree.length === 0 ? (
              <div className="text-xs text-[#5a5a6e] text-center py-6">
                「+ 新規ページ」から作成してください
              </div>
            ) : (
              tree.map(node => (
                <TreeItem
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedId={selectedId}
                  expanded={expanded}
                  onSelect={setSelectedId}
                  onToggle={toggle}
                  onAddChild={createPage}
                  onDelete={deletePage}
                />
              ))
            )}
          </div>
        </div>

        {/* Editor pane */}
        <div className={`flex-1 min-w-0 ${selectedId === null ? 'hidden md:block' : ''}`}>
          {selectedId === null ? (
            <div className="text-[#5a5a6e] text-sm text-center py-20">
              ページを選択するか、新規作成してください
            </div>
          ) : (
            <>
              {/* Mobile back button */}
              <button
                onClick={() => setSelectedId(null)}
                className="md:hidden mb-2 text-sm text-[#8b8b9e] hover:text-white transition-colors"
              >
                ◀ ページ一覧
              </button>
              <WikiEditor
                key={selectedId}
                pageId={selectedId}
                ancestors={ancestors}
                onTitleChanged={refetch}
                onDeleted={handleDeleted}
                onNavigate={setSelectedId}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
