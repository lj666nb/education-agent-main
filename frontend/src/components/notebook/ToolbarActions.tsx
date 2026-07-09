import React, { useState, useRef, useCallback } from 'react'
import './notebook.css'

interface ToolbarActionsProps {
  onRefresh: () => void
  loading: boolean
  isFullscreen: boolean
  onToggleFullscreen: () => void
  onComposeNote: () => void
  composing: boolean
  hasSelection: boolean
  onGenerateVideo: () => void
  onGenerateMindmap: () => void
  onGenerateCodeCase: () => void
  onGenerateDocument: () => void
  onGenerateImageText: () => void
}

export default function ToolbarActions({
  onRefresh,
  loading,
  isFullscreen,
  onToggleFullscreen,
  onComposeNote,
  composing,
  hasSelection,
  onGenerateVideo,
  onGenerateMindmap,
  onGenerateCodeCase,
  onGenerateDocument,
  onGenerateImageText,
}: ToolbarActionsProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openDropdown = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
    setDropdownOpen(true)
  }, [])

  const closeDropdown = useCallback(() => {
    closeTimer.current = setTimeout(() => setDropdownOpen(false), 150)
  }, [])

  const handleGen = (fn: () => void) => { setDropdownOpen(false); fn() }

  return (
    <>
      {/* AI compose note button */}
      {hasSelection && (
        <button
          className="nb-toolbar-btn nb-toolbar-btn--primary"
          onClick={onComposeNote}
          disabled={composing}
          title="AI 智能编排当前知识点的所有资源为一份高质量学习笔记"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          {composing ? 'AI 编排中...' : 'AI 生成笔记'}
        </button>
      )}

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

      {/* Fullscreen toggle */}
      <button className="nb-toolbar-btn" onClick={onToggleFullscreen} title={isFullscreen ? '退出全屏' : '全屏'}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {isFullscreen ? (
            <>
              <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
            </>
          ) : (
            <>
              <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
            </>
          )}
        </svg>
      </button>

      {/* Generate dropdown */}
      <div className="nb-toolbar-dropdown" onMouseEnter={openDropdown} onMouseLeave={closeDropdown}>
        <button className="nb-toolbar-btn nb-toolbar-btn--primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          生成资源
        </button>
        {dropdownOpen && (
          <div className="nb-toolbar-dropdown-menu" onMouseEnter={openDropdown} onMouseLeave={closeDropdown}>
            <button className="nb-toolbar-dropdown-item" onClick={() => handleGen(onGenerateMindmap)}>🧠 生成思维导图</button>
            <button className="nb-toolbar-dropdown-item" onClick={() => handleGen(onGenerateCodeCase)}>💻 生成代码案例</button>
            <button className="nb-toolbar-dropdown-item" onClick={() => handleGen(onGenerateImageText)}>🖼️ 生成图文讲解</button>
            <button className="nb-toolbar-dropdown-item" onClick={() => handleGen(onGenerateDocument)}>📄 生成文档</button>
            <button className="nb-toolbar-dropdown-item" onClick={() => handleGen(onGenerateVideo)}>🎬 生成视频讲解</button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
