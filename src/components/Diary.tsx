import { useState, useEffect } from 'react'
import { apiPut } from '../hooks/useApi'
import type { PartialBlock } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/mantine'
import { useCreateBlockNote } from '@blocknote/react'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'

export default function Diary({ date }: { date: string }) {
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [initialContent, setInitialContent] = useState<PartialBlock[] | undefined>(undefined)
  const [hasChanges, setHasChanges] = useState(false)

  // BlockNoteエディタの初期化
  const editor = useCreateBlockNote({
    initialContent: initialContent,
  })

  // 日記データの読み込み
  useEffect(() => {
    setLoading(true)
    setSaved(false)
    setHasChanges(false)
    fetch(`/api/diary/${date}`)
      .then(r => r.json())
      .then(d => {
        try {
          // サーバーからのデータをパース
          if (d.content && d.content.trim() !== '') {
            // まずJSON形式として試す
            try {
              const parsedContent = JSON.parse(d.content) as PartialBlock[]
              setInitialContent(parsedContent)
            } catch {
              // JSON形式でない場合（既存のプレーンテキスト）、Markdown形式として扱う
              const lines = d.content.split('\n')
              const blocks: PartialBlock[] = lines.map((line: string) => {
                // 見出しの検出
                if (line.startsWith('# ')) {
                  return {
                    type: 'heading',
                    props: { level: 1 },
                    content: line.substring(2),
                  }
                } else if (line.startsWith('## ')) {
                  return {
                    type: 'heading',
                    props: { level: 2 },
                    content: line.substring(3),
                  }
                } else if (line.startsWith('### ')) {
                  return {
                    type: 'heading',
                    props: { level: 3 },
                    content: line.substring(4),
                  }
                } else {
                  return {
                    type: 'paragraph',
                    content: line || '',
                  }
                }
              })
              setInitialContent(blocks)
            }
          } else {
            // 空の場合はデフォルトコンテンツを設定
            setInitialContent([
              {
                type: 'paragraph',
                content: '',
              },
            ])
          }
        } catch (error) {
          console.error('コンテンツの読み込みエラー:', error)
          // エラーの場合は空のコンテンツを設定
          setInitialContent([
            {
              type: 'paragraph',
              content: '',
            },
          ])
        }
        setLoading(false)
      })
      .catch(error => {
        console.error('読み込みエラー:', error)
        setInitialContent([
          {
            type: 'paragraph',
            content: '',
          },
        ])
        setLoading(false)
      })
  }, [date])

  // エディタのコンテンツを更新
  useEffect(() => {
    if (!loading && initialContent && editor) {
      editor.replaceBlocks(editor.document, initialContent)
      setHasChanges(false)
    }
  }, [initialContent, loading, editor])

  // エディタの変更を検知
  useEffect(() => {
    if (editor && !loading) {
      const handleChange = () => {
        setHasChanges(true)
        setSaved(false)
      }

      editor.onChange(handleChange)
    }
  }, [editor, loading])

  // 自動保存（5秒後に未保存の変更があれば保存）
  useEffect(() => {
    if (!hasChanges || loading) return

    const timer = setTimeout(() => {
      handleSave()
    }, 5000)

    return () => clearTimeout(timer)
  }, [hasChanges, loading, date])

  // 保存処理
  const handleSave = async () => {
    try {
      const blocks = editor.document
      const contentJson = JSON.stringify(blocks)
      await apiPut(`/api/diary/${date}`, { content: contentJson })
      setSaved(true)
      setHasChanges(false)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('保存エラー:', error)
      alert('保存に失敗しました')
    }
  }

  return (
    <div className="w-full">
      <h2 className="techo-heading text-2xl mb-4">日記</h2>

      {loading ? (
        <p className="text-[#5a5a6e]">読み込み中...</p>
      ) : (
        <>
          <div className="bg-[#16161e] border border-[#2a2a3a] rounded-xl p-4 min-h-[120px] shadow-lg">
            <BlockNoteView
              editor={editor}
              theme="dark"
              data-theming-css-variables-demo
            />
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handleSave}
              className="bg-amber-500 text-black font-semibold px-6 py-2 rounded-lg hover:bg-amber-400 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={!hasChanges}
            >
              保存
            </button>
            {saved && <span className="text-amber-400 text-sm">保存しました</span>}
            {hasChanges && !saved && <span className="text-[#8b8b9e] text-sm">未保存の変更があります</span>}
          </div>
        </>
      )}
    </div>
  )
}
