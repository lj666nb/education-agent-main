import React, { useState, useRef, useEffect } from 'react'
import './notebook.css'

interface ToolbarActionsProps {
  onRefresh: () => void
  loading: boolean
  onGenerateVideo: () => void
  onGenerateMindmap: () => void
  onGenerateCodeCase: () => void
  onGenerateDocument: () => void
  onGenerateImageText: () => void
}

export default function ToolbarActions({
  onRefresh,
  loading,
  onGenerateVideo,
  onGenerateMindmap,
  onGenerateCodeCase,
  onGenerateDocument,
  onGenerateImageText,
}: ToolbarActionsProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  const handleGen = (fn: () => void) => {
    setDropdownOpen(false)
    fn()
  }

  return (
    <>
      {/* Refresh button */}
      <button className="nb-toolbar-btn" onClick={onRefresh} disabled={loading} title="刷新推荐">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
        {loading ? '刷新中...' : '刷新'}
      </button>

      {/* Generate dropdown */}
      <div className="nb-toolbar-dropdown" ref={dropdownRef}>
        <button
          className="nb-toolbar-btn nb-toolbar-btn--primary"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          生成资源
        </button>

        {dropdownOpen && (
          <div className="nb-toolbar-dropdown-menu">
            <button className="nb-toolbar-dropdown-item" onClick={() => handleGen(onGenerateMindmap)}>
              🧠 生成思维导图
            </button>
            <button className="nb-toolbar-dropdown-item" onClick={() => handleGen(onGenerateCodeCase)}>
              💻 生成代码案例
            </button>
            <button className="nb-toolbar-dropdown-item" onClick={() => handleGen(onGenerateImageText)}>
              🖼️ 生成图文讲解
            </button>
            <button className="nb-toolbar-dropdown-item" onClick={() => handleGen(onGenerateDocument)}>
              📄 生成文档
            </button>
            <button className="nb-toolbar-dropdown-item" onClick={() => handleGen(onGenerateVideo)}>
              🎬 生成视频讲解
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
