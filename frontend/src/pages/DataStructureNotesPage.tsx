import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { chapters, type NoteChapter, type NoteSection } from '../components/notes/ds-notes'
import '../components/notes/notes.css'

export default function DataStructureNotesPage() {
  const navigate = useNavigate()
  const contentRef = useRef<HTMLDivElement>(null)

  // State
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    new Set(chapters.map(c => c.id))
  )
  const [selectedSection, setSelectedSection] = useState<{
    chapter: NoteChapter; section: NoteSection
  } | null>(() => {
    const first = chapters[0]
    return first ? { chapter: first, section: first.sections[0] } : null
  })
  const [mobileSidebar, setMobileSidebar] = useState(false)

  // Scroll to top when section changes
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0)
  }, [selectedSection?.section.id])

  const toggleChapter = useCallback((id: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const selectSection = useCallback((chapter: NoteChapter, section: NoteSection) => {
    setSelectedSection({ chapter, section })
    setMobileSidebar(false)
  }, [])

  // Simple markdown-to-HTML converter
  const renderMarkdown = (md: string): string => {
    let h = md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Escaped backslashes in code
    h = h.replace(/\\\\/g, '&#92;&#92;')
    // Code blocks
    h = h.replace(/```(\w*)\n([\s\S]*?)```/g, (_: string, lang: string, code: string) => {
      const c = code.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#92;&#92;/g,'\\\\')
      return `<pre><code class="language-${lang}">${c}</code></pre>`
    })
    // Inline code
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Headers
    h = h.replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>')
    h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>')
    h = h.replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Tables
    h = h.replace(/^\|(.+)\|$/gm, (row: string) => {
      const cells = row.split('|').filter((c, i, a) => {
        const t = c.trim()
        if (!t || /^[-:]+$/.test(t)) return false
        return i > 0 && i < a.length - 1
      })
      if (cells.length === 0) return row
      const isHeader = h.includes('---')
      const tag = isHeader ? 'th' : 'td'
      return '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>'
    })
    // Lists
    h = h.replace(/^- (.+)$/gm, '<li>$1</li>')
    h = h.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    // Blockquotes
    h = h.replace(/^&gt; (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
    // Merge adjacent blockquotes
    h = h.replace(/<\/blockquote>\n<blockquote>/g, '')
    // Horizontal rules
    h = h.replace(/^---$/gm, '<hr>')
    // Paragraphs
    h = h.replace(/\n\n+/g, '</p><p>')
    h = h.replace(/\n/g, '<br>')
    // Cleanup
    h = h.replace(/<p><(pre|h[1-4]|ul|ol|blockquote|table|tr|hr)/g, '<$1')
    h = h.replace(/<\/(pre|h[1-4]|ul|ol|blockquote|table|tr)><\/p>/g, '</$1>')
    h = h.replace(/<p><\/p>/g, '')
    return `<p>${h}</p>`
  }

  return (
    <div className="ds-page">
      {/* Mobile hamburger */}
      <button
        style={{
          display: 'none', position: 'fixed', top: 12, left: 12, zIndex: 300,
          padding: '8px', borderRadius: 6, border: '1px solid var(--ds-border)',
          background: '#fff', cursor: 'pointer', fontSize: 18,
        }}
        onClick={() => setMobileSidebar(true)}
        className="ds-mobile-btn"
      >
        ☰
      </button>

      {/* Overlay */}
      {mobileSidebar && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 199,
          background: 'rgba(0,0,0,0.3)',
        }} onClick={() => setMobileSidebar(false)} />
      )}

      {/* ── Left Sidebar ── */}
      <aside className={`ds-sidebar${mobileSidebar ? ' ds-sidebar--open' : ''}`}>
        <div className="ds-sidebar-header">
          📖 数据结构笔记
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {chapters.map(ch => {
            const isExpanded = expandedChapters.has(ch.id)
            return (
              <div key={ch.id} className="ds-sidebar-chapter">
                <div className="ds-sidebar-chapter-title" onClick={() => toggleChapter(ch.id)}>
                  <span className={`ds-sidebar-chevron${isExpanded ? ' ds-sidebar-chevron--open' : ''}`}>▶</span>
                  <span className="ds-sidebar-chapter-icon">{ch.icon}</span>
                  {ch.title}
                </div>
                {isExpanded && ch.sections.map(sec => (
                  <button
                    key={sec.id}
                    className={`ds-sidebar-section${selectedSection?.section.id === sec.id ? ' ds-sidebar-section--active' : ''}`}
                    onClick={() => selectSection(ch, sec)}
                  >
                    {sec.title}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
        {/* Footer */}
        <div style={{
          padding: '12px 20px', fontSize: 12, color: 'var(--ds-text-muted)',
          borderTop: '1px solid var(--ds-border)',
        }}>
          <button onClick={() => navigate('/home')}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: 'var(--ds-accent)', fontSize: 12, padding: 0,
            }}>
            ← 返回首页
          </button>
          <div style={{ marginTop: 4 }}>数据结构学习笔记</div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="ds-content" ref={contentRef}>
        {selectedSection ? (
          <div>
            <div style={{ fontSize: 12, color: 'var(--ds-text-muted)', marginBottom: 6 }}>
              {selectedSection.chapter.icon} {selectedSection.chapter.title}
            </div>
            <div
              dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedSection.section.content) }}
            />
            {/* Navigation between sections */}
            <hr />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
              <NavButton
                chapters={chapters}
                current={selectedSection.section.id}
                direction="prev"
                onNavigate={(ch, sec) => selectSection(ch, sec)}
              />
              <NavButton
                chapters={chapters}
                current={selectedSection.section.id}
                direction="next"
                onNavigate={(ch, sec) => selectSection(ch, sec)}
              />
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--ds-text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📖</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ds-text-primary)' }}>选择章节开始阅读</div>
            <div style={{ fontSize: 14, marginTop: 8 }}>从左侧目录选择要学习的数据结构内容</div>
          </div>
        )}
      </main>
    </div>
  )
}

/** Previous/Next navigation */
function NavButton({ chapters, current, direction, onNavigate }: {
  chapters: NoteChapter[]; current: string; direction: 'prev' | 'next';
  onNavigate: (ch: NoteChapter, sec: NoteSection) => void;
}) {
  const allSections: Array<{ chapter: NoteChapter; section: NoteSection }> = []
  for (const ch of chapters) {
    for (const sec of ch.sections) {
      allSections.push({ chapter: ch, section: sec })
    }
  }
  const idx = allSections.findIndex(s => s.section.id === current)
  if (idx === -1) return null

  const target = direction === 'prev' ? allSections[idx - 1] : allSections[idx + 1]
  if (!target) return <div />

  return (
    <button
      onClick={() => onNavigate(target.chapter, target.section)}
      style={{
        padding: '8px 16px', borderRadius: 6,
        border: '1px solid var(--ds-border)', background: '#fff',
        cursor: 'pointer', fontSize: 13, color: 'var(--ds-accent)',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ds-accent)'; e.currentTarget.style.background = 'var(--ds-accent-light)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ds-border)'; e.currentTarget.style.background = '#fff' }}
    >
      {direction === 'prev' ? '←' : ''} {target.section.title} {direction === 'next' ? '→' : ''}
    </button>
  )
}
