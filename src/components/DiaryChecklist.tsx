import { useState, useEffect, useRef, useCallback } from 'react'
import { apiPut } from '../hooks/useApi'

interface DiaryChecklistProps {
  date: string
  content: string  // raw BlockNote JSON string
  onUpdated: () => void
  flushTrigger?: number  // increment to trigger flush (save checked items as faded)
  flushRef?: React.RefObject<(() => Promise<void>) | null>  // expose flush for imperative call
}

interface FlatLine {
  text: string
  path: number[]
  depth: number
  isFaded: boolean  // already marked as faded (gray) from previous session
}

// Check if a block has been faded (previously checked)
// Uses block-level props.textColor so data-text-color attribute is applied (CSS-targetable)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isBlockFaded(block: any): boolean {
  return block.props?.textColor === 'gray'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenBlocks(blocks: any[], basePath: number[], depth: number): FlatLine[] {
  const lines: FlatLine[] = []
  blocks.forEach((block, i) => {
    const path = [...basePath, i]
    const text = (block.content ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any) => c.text ?? '')
      .join('')
    if (text.trim()) {
      const prefix = block.type === 'bulletListItem' || block.type === 'numberedListItem' ? '・' : ''
      lines.push({ text: `${prefix}${text}`, path, depth, isFaded: isBlockFaded(block) })
    }
    if (block.children?.length) {
      lines.push(...flattenBlocks(block.children, path.concat([-1]), depth + 1))
    }
  })
  return lines
}

// Apply gray text color to a block at the given path
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fadeBlockAtPath(blocks: any[], path: number[]): any[] {
  if (path.length === 0) return blocks

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = blocks.map((b: any) => ({
    ...b,
    children: Array.isArray(b.children) ? [...b.children] : [],
  }))

  if (path.length === 1) {
    const block = result[path[0]]
    if (block) {
      // Set block-level textColor so data-text-color="gray" attribute is applied
      // This is CSS-targetable (unlike inline span style used by content-item textColor)
      result[path[0]] = {
        ...block,
        props: { ...(block.props ?? {}), textColor: 'gray' },
      }
    }
    return result
  }

  // Path has children marker: [parentIdx, -1, childIdx, ...]
  const parentIdx = path[0]
  if (path[1] === -1 && result[parentIdx]) {
    result[parentIdx] = {
      ...result[parentIdx],
      children: fadeBlockAtPath(result[parentIdx].children, path.slice(2)),
    }
  }
  return result
}

export default function DiaryChecklist({ date, content, onUpdated, flushTrigger = 0, flushRef }: DiaryChecklistProps) {
  const [checkedPaths, setCheckedPaths] = useState<Set<string>>(new Set())
  const checkedRef = useRef(checkedPaths)
  const contentRef = useRef(content)
  const dateRef = useRef(date)

  checkedRef.current = checkedPaths
  contentRef.current = content
  dateRef.current = date

  // Reset checked state when date or content changes
  useEffect(() => {
    setCheckedPaths(new Set())
  }, [date, content])

  // Flush: apply faded styles to checked items and save
  const flush = useCallback(async () => {
    const checked = checkedRef.current
    if (checked.size === 0) return

    try {
      const parsed = JSON.parse(contentRef.current)
      if (!Array.isArray(parsed)) return

      let blocks = parsed
      // Apply fading to all checked paths
      const lines = flattenBlocks(blocks, [], 0)
      for (const line of lines) {
        const key = line.path.join('-')
        if (checked.has(key) && !line.isFaded) {
          blocks = fadeBlockAtPath(blocks, line.path)
        }
      }

      await apiPut(`/api/diary/${dateRef.current}`, { content: JSON.stringify(blocks) })
      setCheckedPaths(new Set())
      onUpdated()
    } catch (e) {
      console.error('Failed to save diary changes:', e)
    }
  }, [onUpdated])

  // Expose flush via ref for imperative calls (e.g. before unmount)
  useEffect(() => {
    if (flushRef) flushRef.current = flush
    return () => { if (flushRef) flushRef.current = null }
  }, [flush, flushRef])

  // Respond to flushTrigger changes
  const prevTriggerRef = useRef(flushTrigger)
  useEffect(() => {
    if (flushTrigger !== prevTriggerRef.current && flushTrigger > 0) {
      prevTriggerRef.current = flushTrigger
      flush()
    }
  }, [flushTrigger, flush])

  const toggleCheck = (pathKey: string) => {
    setCheckedPaths(prev => {
      const next = new Set(prev)
      if (next.has(pathKey)) next.delete(pathKey)
      else next.add(pathKey)
      return next
    })
  }

  if (!content) {
    return <p className="text-xs text-[#2a2a3a] italic">この日の日記はありません</p>
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let blocks: any[]
  try {
    const parsed = JSON.parse(content)
    if (!Array.isArray(parsed)) {
      return <pre className="text-xs text-[#a0a0b8] leading-relaxed whitespace-pre-wrap font-sans">{content}</pre>
    }
    blocks = parsed
  } catch {
    return <pre className="text-xs text-[#a0a0b8] leading-relaxed whitespace-pre-wrap font-sans">{content}</pre>
  }

  const lines = flattenBlocks(blocks, [], 0)

  if (lines.length === 0) {
    return <p className="text-xs text-[#2a2a3a] italic">この日の日記はありません</p>
  }

  return (
    <div className="space-y-0.5">
      {lines.map(line => {
        const pathKey = line.path.join('-')
        const isChecked = checkedPaths.has(pathKey)

        // Already faded from previous session
        if (line.isFaded) {
          return (
            <div
              key={pathKey}
              className="flex items-start gap-2 px-1 py-1"
              style={{ paddingLeft: `${line.depth * 12 + 4}px` }}
            >
              <span className="mt-0.5 w-3.5 h-3.5 shrink-0" />
              <span className="text-xs text-[#606078] leading-relaxed flex-1 break-all line-through opacity-50">
                {line.text}
              </span>
            </div>
          )
        }

        return (
          <div
            key={pathKey}
            className={`group flex items-start gap-2 px-1 py-1 rounded transition-all hover:bg-[#1e1e2a]`}
            style={{ paddingLeft: `${line.depth * 12 + 4}px` }}
          >
            <button
              onClick={() => toggleCheck(pathKey)}
              className={`mt-0.5 w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-all ${
                isChecked
                  ? 'bg-amber-500/20 border-amber-500/50'
                  : 'border-[#3a3a4a] hover:border-amber-500/50 hover:bg-amber-500/10'
              }`}
            >
              {isChecked && <span className="text-[8px] text-amber-400">✓</span>}
            </button>
            <span className={`text-xs leading-relaxed flex-1 break-all transition-all ${
              isChecked ? 'text-[#5a5a6e] line-through' : 'text-[#a0a0b8]'
            }`}>
              {line.text}
            </span>
          </div>
        )
      })}
    </div>
  )
}
