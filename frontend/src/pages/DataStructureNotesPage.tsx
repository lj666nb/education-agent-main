import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shapes, List, Layers, TreePine, Workflow, Search, ArrowUpDown, BookOpen,
  type LucideIcon,
} from 'lucide-react'
import { chapters, type NoteChapter, type NoteSection } from '../components/notes/ds-notes'
import MarkdownRenderer from '../components/MarkdownRenderer'
import TutorChat from '../components/notes/TutorChat'
import '../components/notes/notes.css'

/** Map chapter icon name to lucide component */
const ICON_MAP: Record<string, LucideIcon> = {
  'shapes': Shapes,
  'list': List,
  'layers': Layers,
  'tree-pine': TreePine,
  'workflow': Workflow,
  'search': Search,
  'arrow-up-down': ArrowUpDown,
}

function ChapterIcon({ name, size = 16 }: { name: string; size?: number }) {
  const Icon = ICON_MAP[name]
  return Icon ? <Icon size={size} strokeWidth={2} /> : null
}

/** 支持的语言 */
type CodeLang = 'python' | 'c' | 'cpp'
const LANG_OPTIONS: { value: CodeLang; label: string }[] = [
  { value: 'python', label: 'Python' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
]

/** 按语言过滤内容：保留选中语言的 <!-- LANG:xxx --> ... <!-- /LANG --> 块，移除其他语言块 */
function filterContentByLang(content: string, lang: CodeLang): string {
  // 匹配 <!-- LANG:xxx --> ... <!-- /LANG --> 块（xxx 为 python|c|cpp）
  const BLOCK_RE = /<!--\s*LANG:(\w+)\s*-->([\s\S]*?)<!--\s*\/LANG\s*-->/g
  return content.replace(BLOCK_RE, (_match, blockLang: string, blockContent: string) => {
    // 规范化语言名
    const normalized = blockLang.toLowerCase()
    const matchLang =
      (lang === 'c' && normalized === 'c') ||
      (lang === 'cpp' && (normalized === 'cpp' || normalized === 'c++')) ||
      (lang === 'python' && normalized === 'python')
    return matchLang ? blockContent : ''
  })
}

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
  const [codeLang, setCodeLang] = useState<CodeLang>(() => {
    return (localStorage.getItem('ds-notes-code-lang') as CodeLang) || 'python'
  })

  // Persist language preference
  const handleCodeLangChange = useCallback((lang: CodeLang) => {
    setCodeLang(lang)
    localStorage.setItem('ds-notes-code-lang', lang)
  }, [])

  // Filter content by selected language
  const filteredContent = useMemo(() => {
    if (!selectedSection) return ''
    return filterContentByLang(selectedSection.section.content, codeLang)
  }, [selectedSection, codeLang])

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
          <BookOpen size={18} strokeWidth={2} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          数据结构笔记
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {chapters.map(ch => {
            const isExpanded = expandedChapters.has(ch.id)
            return (
              <div key={ch.id} className="ds-sidebar-chapter">
                <div className="ds-sidebar-chapter-title" onClick={() => toggleChapter(ch.id)}>
                  <span className={`ds-sidebar-chevron${isExpanded ? ' ds-sidebar-chevron--open' : ''}`}>▶</span>
                  <span className="ds-sidebar-chapter-icon"><ChapterIcon name={ch.icon} /></span>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--ds-text-muted)' }}>
                <ChapterIcon name={selectedSection.chapter.icon} />{' '}{selectedSection.chapter.title}
              </div>
              {/* Language selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--ds-text-muted)' }}>代码语言:</span>
                <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--ds-border)' }}>
                  {LANG_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => handleCodeLangChange(opt.value)}
                      style={{
                        padding: '3px 10px',
                        fontSize: 11,
                        fontWeight: codeLang === opt.value ? 600 : 400,
                        border: 'none',
                        background: codeLang === opt.value ? 'var(--ds-accent)' : '#fff',
                        color: codeLang === opt.value ? '#fff' : 'var(--ds-text-secondary)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        transition: 'all 0.15s',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <MarkdownRenderer content={filteredContent} />
            </div>
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
            <div style={{ marginBottom: 16 }}><BookOpen size={48} strokeWidth={1.5} /></div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ds-text-primary)' }}>选择章节开始阅读</div>
            <div style={{ fontSize: 14, marginTop: 8 }}>从左侧目录选择要学习的数据结构内容</div>
          </div>
        )}
      </main>

      {/* AI 编程导师 — 浮动对话框 */}
      <TutorChat
        chapter={selectedSection?.chapter ?? null}
        section={selectedSection?.section ?? null}
      />
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
