import { useRef, useState, useEffect, useCallback } from 'react'
import Editor, { type OnMount, loader } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

// Configure Monaco Editor to load from local files (no CDN)
loader.config({ paths: { vs: '/monaco-editor/min/vs' } })

interface CodeEditorProps {
  code: string
  language?: string
  onChange?: (value: string) => void
  readOnly?: boolean
  height?: string | number
}

const COMMON_LANGUAGES = [
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'java', label: 'Java' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'bash', label: 'Bash' },
  { id: 'sql', label: 'SQL' },
]

const EDITOR_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: true },
  fontSize: 13,
  fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
  lineNumbers: 'on',
  renderLineHighlight: 'line',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  wordWrap: 'on',
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  bracketPairColorization: { enabled: true },
  autoIndent: 'full',
  formatOnPaste: true,
  suggestOnTriggerCharacters: true,
  quickSuggestions: true,
  folding: true,
  foldingHighlight: true,
  lineDecorationsWidth: 8,
  padding: { top: 8, bottom: 8 },
}

export default function CodeEditor({ code, language, onChange, readOnly = false, height = '100%' }: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const [fontSize, setFontSize] = useState(13)
  const [showFontSize, setShowFontSize] = useState(false)
  const fontSizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showFontSizeIndicator = useCallback(() => {
    setShowFontSize(true)
    if (fontSizeTimerRef.current) clearTimeout(fontSizeTimerRef.current)
    fontSizeTimerRef.current = setTimeout(() => setShowFontSize(false), 1500)
  }, [])

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor
    editor.focus()
  }

  useEffect(() => {
    // Use Monaco's own zoom as fallback via editor.updateOptions
    if (editorRef.current) {
      editorRef.current.updateOptions({ fontSize })
    }
  }, [fontSize])

  useEffect(() => {
    if (!editorRef.current) return
    const domNode = editorRef.current.getDomNode()
    if (!domNode) return

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      setFontSize(prev => {
        const next = prev - Math.sign(e.deltaY) * 1
        return Math.max(10, Math.min(30, next))
      })
      showFontSizeIndicator()
    }

    domNode.addEventListener('wheel', handleWheel, { passive: false })
    return () => domNode.removeEventListener('wheel', handleWheel)
  }, [showFontSizeIndicator])

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <Editor
        height={height}
        language={language || 'plaintext'}
        value={code}
        onChange={(val) => onChange?.(val || '')}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        options={{
          ...EDITOR_OPTIONS,
          fontSize,
          readOnly,
          domReadOnly: readOnly,
        }}
        loading={
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--gray-400)',
            fontSize: '0.875rem',
            backgroundColor: '#1e1e1e',
          }}>
            加载编辑器中...
          </div>
        }
      />
      {showFontSize && (
        <div style={{
          position: 'absolute',
          bottom: 10,
          right: 14,
          padding: '4px 10px',
          borderRadius: 6,
          background: 'rgba(0,0,0,0.75)',
          color: '#e5e7eb',
          fontSize: 12,
          fontFamily: 'monospace',
          pointerEvents: 'none',
          zIndex: 10,
          transition: 'opacity 0.3s ease',
        }}>
          {fontSize}px
        </div>
      )}
    </div>
  )
}

export { COMMON_LANGUAGES }
