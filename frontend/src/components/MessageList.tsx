import { useEffect, useRef, useState, useCallback } from 'react'
import { LinkIcon } from './Icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { splitContentWithDiagrams } from '../utils/drawio'
import { detectLanguage, LANGUAGE_NAMES } from '../utils/codeRunner'
import DiagramImage from './DiagramImage'

export interface RagSource {
  document_name: string
  content_snippet: string
  score: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning_content?: string
  sources?: RagSource[]
  timestamp?: Date
  diagramXml?: string
}

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
  enableThinking?: boolean
  onRunCode?: (code: string, language: string) => void
  onRollback?: (messageId: string) => void
  onEditDiagram?: (xml: string) => void
  onGenerateMindmap?: (messageId: string, content: string) => void
}

function BrainIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 1 4 4c0 1.1-.4 2-1 2.7V10c0 1.1-.9 2-2 2s-2-.9-2-2V8.7c-.6-.7-1-1.6-1-2.7a4 4 0 0 1 4-4z"/>
      <path d="M12 14c2.2 0 6 1.1 6 3v2H6v-2c0-1.9 3.8-3 6-3z"/>
    </svg>
  )
}

function ExportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
      <path d="M17 8l-5-5-5 5"/>
    </svg>
  )
}

function simpleMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // Code blocks (must come before inline code)
  let html = escaped.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:#1a1a2e;color:#e4e4e4;padding:12px;border-radius:8px;overflow-x:auto;font-size:12px;line-height:1.5;margin:8px 0;"><code>$2</code></pre>')
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px;color:#dc2626;">$1</code>')
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
  // Strikethrough
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>')
  // Newlines
  html = html.replace(/\n/g, '<br/>')
  return html
}

export default function MessageList({ messages, isLoading, enableThinking = false, onRunCode, onRollback, onEditDiagram, onGenerateMindmap }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const userScrolledAwayRef = useRef(false)
  const ignoreScrollRef = useRef(false)
  const lastWheelUpRef = useRef(0)

  const scrollToBottom = (smooth = true) => {
    if (userScrolledAwayRef.current) return
    const el = scrollContainerRef.current
    if (!el) return
    // Mark programmatic scroll so handleScroll ignores it
    ignoreScrollRef.current = true
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }

  const prevLoadingRef = useRef(isLoading)
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return

    // Disable CSS scroll anchoring so scroll anchoring / sticky-scroll
    // doesn't override manual scrollTop changes during streaming.
    el.style.setProperty('overflow-anchor', 'none')

    // Wheel event fires BEFORE scroll event AND before React effects.
    // This lets us flag that the user is scrolling BEFORE the next
    // auto-scroll effect runs, preventing a race where a user's scroll-up
    // event arrives after the effect has already pushed the viewport down.
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) {
        userScrolledAwayRef.current = true
        lastWheelUpRef.current = Date.now()
      }
    }
    const onScroll = () => {
      if (ignoreScrollRef.current) { ignoreScrollRef.current = false; return }
      const e = scrollContainerRef.current
      if (!e) return
      // Don't clear scrolled-away flag within 3s of wheel-up (prevents
      // scroll anchoring from prematurely resuming auto-scroll).
      if (Date.now() - lastWheelUpRef.current < 3000) return
      if (e.scrollHeight - e.scrollTop - e.clientHeight < 120) {
        userScrolledAwayRef.current = false
      }
    }
    el.addEventListener('wheel', onWheel, { passive: true })
    el.addEventListener('scroll', onScroll, { passive: true })

    // Auto-scroll: scroll to bottom when new content arrives
    if (isLoading) {
      scrollToBottom(false)
    }
    if (prevLoadingRef.current && !isLoading) {
      scrollToBottom(true)
    }
    prevLoadingRef.current = isLoading

    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('scroll', onScroll)
    }
  }, [messages, isLoading])



  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportBtnRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState<'pdf' | 'word' | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportBtnRef.current && !exportBtnRef.current.contains(e.target as Node)) {
        setShowExportMenu(false)
      }
    }
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showExportMenu])

  const buildExportHtml = useCallback((title: string) => {
    const roleLabel: Record<string, string> = { user: '用户', assistant: 'AI', system: '系统' }
    const roleColor: Record<string, string> = { user: 'var(--app-brand)', assistant: 'var(--app-text-body)', system: 'var(--app-text-secondary)' }
    const roleBg: Record<string, string> = { user: 'var(--app-brand-bg)', assistant: 'var(--app-bg-card-alt)', system: 'var(--app-bg-page)' }
    const align: Record<string, string> = { user: 'right', assistant: 'left', system: 'center' }

    let html = messages.map(msg => {
      const r = msg.role
      const bubbleStyle = `display:inline-block;max-width:80%;padding:12px 16px;border-radius:12px;background:${roleBg[r]};color:${roleColor[r]};text-align:left;`
      return `<div style="margin-bottom:16px;text-align:${align[r]};">` +
        `<div style="${bubbleStyle}">` +
        `<div style="font-size:11px;font-weight:600;margin-bottom:4px;color:${roleColor[r]};">${roleLabel[r]}</div>` +
        `<div style="font-size:14px;line-height:1.7;">${simpleMarkdown(msg.content)}</div>` +
        `</div></div>`
    }).join('\n')

    return `<div style="font-family:'Segoe UI',Arial,sans-serif;padding:40px;max-width:800px;margin:0 auto;background:white;">` +
      `<h1 style="font-size:20px;text-align:center;margin-bottom:8px;color:#1F2937;">${title}</h1>` +
      `<p style="font-size:11px;text-align:center;color:#9CA3AF;margin-bottom:28px;">导出时间: ${new Date().toLocaleString('zh-CN')}</p>` +
      html + `</div>`
  }, [messages])

  const exportToPDF = useCallback(async () => {
    setShowExportMenu(false)
    setExporting('pdf')
    try {
      const temp = document.createElement('div')
      temp.innerHTML = buildExportHtml('AI 对话导出')
      temp.style.position = 'fixed'
      temp.style.left = '-9999px'
      temp.style.top = '0'
      temp.style.zIndex = '-1'
      temp.style.width = '800px'
      temp.style.backgroundColor = 'white'
      document.body.appendChild(temp)

      await new Promise(r => setTimeout(r, 150))

      const canvas = await html2canvas(temp, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: temp.scrollWidth,
        height: temp.scrollHeight,
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.95)
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pw = pdf.internal.pageSize.getWidth()
      const ph = pdf.internal.pageSize.getHeight()
      const margin = 12
      const imgW = pw - margin * 2
      const imgH = (canvas.height * imgW) / canvas.width
      let left = imgH
      let pos = margin

      pdf.addImage(imgData, 'JPEG', margin, pos, imgW, imgH)
      left -= ph - margin * 2

      while (left > 0) {
        pos = pos - (ph - margin * 2)
        pdf.addPage()
        pdf.addImage(imgData, 'JPEG', margin, pos, imgW, imgH)
        left -= ph - margin * 2
      }

      pdf.save('AI对话导出.pdf')
    } catch (err) {
      console.error('PDF 导出失败:', err)
      alert('PDF 导出失败，请重试')
    } finally {
      document.querySelector('div[style*="left: -9999px"]')?.remove()
      setExporting(null)
    }
  }, [buildExportHtml])

  const exportToWord = useCallback(() => {
    setShowExportMenu(false)
    setExporting('word')
    try {
      const html = buildExportHtml('AI 对话导出')
      const fullDoc = `﻿<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset="utf-8"><title>AI 对话导出</title></head><body>${html}</body></html>`
      const blob = new Blob([fullDoc], { type: 'application/msword' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'AI对话导出.doc'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Word 导出失败:', err)
      alert('Word 导出失败，请重试')
    } finally {
      setExporting(null)
    }
  }, [buildExportHtml])

  const codeBlockCounterRef = useRef(0)

  const renderMessageContent = (content: string, msgId?: string) => {
    return (
      <ReactMarkdown
        components={{
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const isInline = !match && !className
            const codeString = String(children).replace(/\n$/, '')
            const lang = detectLanguage(className)
            const langName = LANGUAGE_NAMES[lang] || lang
            const codeIdx = codeBlockCounterRef.current++

            if (isInline) {
              return (
                <code
                  style={{
                    backgroundColor: 'var(--gray-100)',
                    padding: '0.2em 0.4em',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.875em',
                    color: 'var(--danger)',
                  }}
                  {...props}
                >
                  {children}
                </code>
              )
            }

            return (
              <div style={{ margin: '1rem 0' }}>
                {/* Code block header bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.25rem 0.75rem',
                  backgroundColor: '#1a1a2e',
                  borderTopLeftRadius: 'var(--radius-md)',
                  borderTopRightRadius: 'var(--radius-md)',
                  borderBottom: '1px solid #333',
                }}>
                  <span style={{
                    fontSize: '0.7rem',
                    color: '#888',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    {langName}
                  </span>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(codeString).catch(() => {})
                      }}
                      title="复制代码"
                      style={{
                        padding: '0.125rem 0.5rem',
                        fontSize: '0.65rem',
                        border: '1px solid #444',
                        borderRadius: '3px',
                        backgroundColor: '#2d2d2d',
                        color: '#aaa',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      复制
                    </button>
                    <button
                      onClick={() => onRunCode?.(codeString, lang)}
                      title="运行代码"
                      style={{
                        padding: '0.125rem 0.5rem',
                        fontSize: '0.65rem',
                        border: 'none',
                        borderRadius: '3px',
                        backgroundColor: '#2ea043',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontWeight: 500,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                      运行
                    </button>
                    {lang === 'python' && (
                      <button
                        onClick={() => { if (onRunCode) onRunCode(codeString, lang) }}
                        disabled={false}
                        title="运行 Python 代码"
                        style={{
                          padding: '0.125rem 0.5rem',
                          fontSize: '0.65rem',
                          border: 'none',
                          borderRadius: '3px',
                          backgroundColor: '#7C3AED',
                          color: 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontWeight: 500,
                          opacity: 1,
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        绘制
                      </button>
                    )}
                  </div>
                </div>
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={match ? match[1] : 'text'}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: 0,
                    borderBottomLeftRadius: 'var(--radius-md)',
                    borderBottomRightRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                  }}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            )
          },
          p({ children }) {
            return <p style={{ margin: '0.5rem 0', lineHeight: 1.6 }}>{children}</p>
          },
          ul({ children }) {
            return <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>{children}</ul>
          },
          ol({ children }) {
            return <ol style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>{children}</ol>
          },
          h1({ children }) {
            return <h1 style={{ fontSize: '1.5rem', margin: '1rem 0', fontWeight: 600 }}>{children}</h1>
          },
          h2({ children }) {
            return <h2 style={{ fontSize: '1.25rem', margin: '1rem 0', fontWeight: 600 }}>{children}</h2>
          },
          h3({ children }) {
            return <h3 style={{ fontSize: '1.125rem', margin: '1rem 0', fontWeight: 600 }}>{children}</h3>
          },
          blockquote({ children }) {
            return (
              <blockquote
                style={{
                  borderLeft: '4px solid var(--primary)',
                  paddingLeft: '1rem',
                  margin: '1rem 0',
                  color: 'var(--gray-500)',
                }}
              >
                {children}
              </blockquote>
            )
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                {children}
              </a>
            )
          },
          table({ children }) {
            return (
              <table style={{ borderCollapse: 'collapse', width: '100%', margin: '1rem 0', fontSize: '0.875rem' }}>
                {children}
              </table>
            )
          },
          thead({ children }) {
            return <thead style={{ backgroundColor: 'var(--gray-100)' }}>{children}</thead>
          },
          th({ children, style }) {
            return (
              <th style={{ border: '1px solid var(--gray-300)', padding: '0.5rem', textAlign: 'left', fontWeight: 600, ...style }}>
                {children}
              </th>
            )
          },
          td({ children, style }) {
            return <td style={{ border: '1px solid var(--gray-300)', padding: '0.5rem', ...style }}>{children}</td>
          },
          img({ src, alt }) {
            return (
              <img
                src={src}
                alt={alt || '图片'}
                style={{ maxWidth: '100%', borderRadius: 8, margin: '0.5rem 0' }}
                loading="lazy"
                onError={(e) => {
                  // 图片加载失败时显示占位提示
                  const target = e.currentTarget
                  target.style.display = 'none'
                  const placeholder = document.createElement('div')
                  placeholder.style.cssText = 'padding:1rem;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;color:#991B1B;font-size:0.875rem;text-align:center'
                  placeholder.textContent = '⚠️ 图片加载失败'
                  target.parentNode?.insertBefore(placeholder, target)
                }}
              />
            )
          },
        }}
        remarkPlugins={[remarkGfm]}
      >
        {content}
      </ReactMarkdown>
    )
  }

  if (messages.length === 0 && !isLoading) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8)',
        background: 'transparent',
      }}>
        {/* 白色低透明度圆角浮层 — 衬底 */}
        <div style={{
          background: 'rgba(255,255,255,0.72)',
          borderRadius: 16,
          padding: '48px 56px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          {/* Education-themed illustration — bold colors, fully opaque */}
          <svg width="160" height="128" viewBox="0 0 160 128" fill="none" style={{ marginBottom: 28 }}>
            {/* Graduation cap */}
            <path d="M80 12L12 48l68 36 68-36-68-36z" fill="#0284C7" stroke="#0369A1" strokeWidth="1.2" />
            <path d="M80 48l20-11v18c0 11-9 20-20 20s-20-9-20-20V37l20 11z" fill="#7DD3FC" stroke="#0369A1" strokeWidth="1.2" />
            {/* Open book */}
            <rect x="22" y="76" width="48" height="36" rx="5" fill="#FCD34D" stroke="#F59E0B" strokeWidth="1.2" />
            <rect x="90" y="76" width="48" height="36" rx="5" fill="#FCD34D" stroke="#F59E0B" strokeWidth="1.2" />
            <line x1="70" y1="76" x2="70" y2="112" stroke="#F59E0B" strokeWidth="1.2" />
            <line x1="32" y1="86" x2="62" y2="86" stroke="#D97706" strokeWidth="1" />
            <line x1="32" y1="94" x2="62" y2="94" stroke="#D97706" strokeWidth="1" />
            <line x1="32" y1="102" x2="54" y2="102" stroke="#D97706" strokeWidth="1" />
            <line x1="98" y1="86" x2="128" y2="86" stroke="#D97706" strokeWidth="1" />
            <line x1="98" y1="94" x2="128" y2="94" stroke="#D97706" strokeWidth="1" />
            <line x1="98" y1="102" x2="120" y2="102" stroke="#D97706" strokeWidth="1" />
            {/* Sparkles */}
            <circle cx="142" cy="28" r="4" fill="#38BDF8" />
            <circle cx="16" cy="22" r="3" fill="#0284C7" />
            <circle cx="148" cy="56" r="2.5" fill="#F59E0B" />
            <circle cx="10" cy="54" r="2" fill="#0284C7" />
          </svg>

          <div style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#111827',
            fontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
            letterSpacing: '0.03em',
            marginBottom: 12,
          }}>
            开始新对话
          </div>
          <div style={{
            fontSize: '0.95rem',
            color: '#6B7280',
            fontWeight: 500,
            marginBottom: 8,
          }}>
            选择模型并开始对话，支持 DeepSeek 和 Qwen
          </div>
          <div style={{
            fontSize: '0.78rem',
            color: '#9CA3AF',
          }}>
            可上传文件、运行代码、生成图表、绘制思维导图
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={scrollContainerRef} style={{
      flex: 1,
      overflowY: 'auto',
      padding: 'var(--space-4)',
      background: 'transparent',
      minHeight: 0,
    }}>
      {(() => { codeBlockCounterRef.current = 0; return null })()}
      {messages.map((message) => (
        <div
          key={message.id}
          className="fade-in"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
            marginBottom: 'var(--space-4)',
            position: 'relative',
          }}
        >
          <div
            style={{
              maxWidth: message.role === 'user' ? '70%' : '85%',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: message.role === 'user' ? 'var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)' : 'var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)',
              backgroundColor: message.role === 'user' ? 'var(--primary)' : 'var(--gray-50)',
              color: message.role === 'user' ? 'white' : 'var(--gray-800)',
              wordBreak: 'break-word',
              lineHeight: 1.6,
            }}
          >
            {message.role === 'assistant' && message.reasoning_content && enableThinking && (
              <div style={{ marginBottom: 'var(--space-3)', fontSize: '0.875rem' }}>
                {isLoading ? (
                  <div style={{
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--warning-bg)',
                    color: 'var(--gray-800)',
                    border: '1px solid oklch(from var(--warning) l c h / 0.3)',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 'var(--space-1)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <BrainIcon /> AI 深度思考中，请稍候...
                    </div>
                  </div>
                ) : (
                  <details>
                    <summary style={{ cursor: 'pointer', color: 'var(--gray-500)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <BrainIcon /> 深度思考（点击查看）
                    </summary>
                    <div style={{
                      padding: 'var(--space-3)',
                      marginTop: 'var(--space-2)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--warning-bg)',
                      color: 'var(--gray-800)',
                      border: '1px solid oklch(from var(--warning) l c h / 0.3)',
                    }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.reasoning_content}</ReactMarkdown>
                    </div>
                  </details>
                )}
              </div>
            )}
            {splitContentWithDiagrams(message.content).map((seg, segIdx) => {
              if (seg.type === 'text') {
                return <div key={segIdx}>{renderMessageContent(seg.content, message.id)}</div>
              } else if (seg.type === 'svg') {
                return (
                  <div key={segIdx} style={{
                    margin: '0.75rem 0',
                    padding: '0.75rem',
                    backgroundColor: 'white',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--gray-100)',
                    overflow: 'auto',
                    textAlign: 'center',
                  }}>
                    <div dangerouslySetInnerHTML={{ __html: seg.content }} />
                  </div>
                )
              } else if (seg.type === 'plot') {
                return (
                  <div key={segIdx} style={{
                    margin: '0.75rem 0',
                    padding: '0.75rem',
                    backgroundColor: 'white',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--gray-100)',
                    textAlign: 'center',
                  }}>
                    {isLoading ? (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: 'var(--space-2)', padding: '1rem 0',
                        color: 'var(--gray-400)', fontSize: '0.875rem',
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" opacity="0.3"/>
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                        </svg>
                        <span>正在生成图表...</span>
                      </div>
                    ) : (
                      <div style={{ padding: '1rem', color: 'var(--gray-500)', fontSize: '0.8125rem' }}>
                        📊 图表将由后端生成，请刷新页面查看
                      </div>
                    )}
                  </div>
                )
              } else {
                return <DiagramImage key={`d-${segIdx}`} xml={seg.content} onEdit={onEditDiagram} />
              }
            })}

            {/* Message action buttons (copy, rollback) */}
            {message.role === 'assistant' && !isLoading && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                marginTop: 'var(--space-2)',
                paddingTop: 'var(--space-1)',
                borderTop: '1px solid var(--gray-200)',
                opacity: 0.4,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
              >
                <button
                  onClick={() => navigator.clipboard.writeText(message.content).catch(() => {})}
                  title="复制此消息"
                  style={{
                    padding: '2px 6px',
                    border: 'none',
                    background: 'none',
                    color: 'var(--gray-500)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '0.7rem',
                    borderRadius: '3px',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  复制
                </button>
                {onRollback && (
                  <button
                    onClick={() => onRollback(message.id)}
                    title="回到此处（删除后续对话）"
                    style={{
                      padding: '2px 6px',
                      border: 'none',
                      background: 'none',
                      color: 'var(--gray-500)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '0.7rem',
                      borderRadius: '3px',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1 4 1 10 7 10"/>
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                    </svg>
                    撤回
                  </button>
                )}
              </div>
            )}

            {/* 生成思维导图按钮 */}
            {message.role === 'assistant' && message.content && message.content.length > 20 && onGenerateMindmap && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                <button onClick={() => onGenerateMindmap(message.id, message.content)}
                  style={{
                    padding: '4px 12px', borderRadius: 6, border: '1px solid #E5E7EB',
                    background: '#fff', color: '#6B7280', fontSize: '0.75rem',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  🧠 生成思维导图
                </button>
              </div>
            )}

            {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
              <details style={{ marginTop: 'var(--space-3)', fontSize: '0.8125rem' }}>
                <summary style={{ cursor: 'pointer', color: 'var(--gray-400)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 'var(--space-1)', userSelect: 'none' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  <LinkIcon size={12} /> 参考来源（{message.sources.length} 项）
                </summary>
                <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {message.sources.map((source, idx) => (
                    <div key={idx} style={{
                      padding: 'var(--space-2) var(--space-3)',
                      backgroundColor: 'var(--gray-50)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--gray-100)',
                    }}>
                      <div style={{ fontWeight: 500, color: 'var(--gray-700)', marginBottom: '2px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                          <polyline points="13 2 13 9 20 9"/>
                        </svg>
                        {source.document_name}
                      </div>
                      <div style={{ color: 'var(--gray-500)', fontSize: '0.6875rem', marginBottom: '2px' }}>
                        相关度: {source.score.toFixed(2)}
                      </div>
                      <div style={{ color: 'var(--gray-400)', fontSize: '0.6875rem', lineHeight: 1.5 }}>
                        {source.content_snippet}...
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="fade-in" style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 'var(--space-4)' }}>
          <div style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)',
            backgroundColor: 'var(--gray-50)',
            color: 'var(--gray-400)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" opacity="0.3"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: '0.8125rem' }}>AI 思考中...</span>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />

      {/* Export button - only when there are messages */}
      {messages.length > 0 && !isLoading && (
        <div ref={exportBtnRef} style={{ position: 'sticky', bottom: 0, display: 'flex', justifyContent: 'flex-end', pointerEvents: 'none', padding: '8px 0' }}>
          <div style={{ position: 'relative', pointerEvents: 'auto' }}>
            <button
              onClick={() => setShowExportMenu(prev => !prev)}
              disabled={exporting !== null}
              title="导出对话"
              style={{
                width: 36, height: 36, borderRadius: '50%',
                border: '1px solid var(--gray-200)',
                backgroundColor: 'white',
                color: 'var(--gray-500)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                transition: 'all 0.15s',
                opacity: exporting ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!exporting) { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--gray-200)'; e.currentTarget.style.color = 'var(--gray-500)' }}
            >
              {exporting ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" opacity="0.3"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
              ) : (
                <ExportIcon />
              )}
            </button>

            {/* Dropdown menu */}
            {showExportMenu && (
              <div className="fade-in" style={{
                position: 'absolute', bottom: '100%', right: 0, marginBottom: 8,
                backgroundColor: 'white', border: '1px solid var(--gray-100)',
                borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)',
                minWidth: 160, overflow: 'hidden', zIndex: 100,
              }}>
                <div
                  onClick={exportToPDF}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', fontSize: '0.8125rem',
                    color: 'var(--gray-700)', display: 'flex', alignItems: 'center', gap: 8,
                    borderBottom: '1px solid var(--gray-50)',
                    transition: 'background-color 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--gray-50)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--app-danger-dark)' }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  导出为 PDF
                </div>
                <div
                  onClick={exportToWord}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', fontSize: '0.8125rem',
                    color: 'var(--gray-700)', display: 'flex', alignItems: 'center', gap: 8,
                    transition: 'background-color 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--gray-50)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--app-blue)' }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  导出为 Word
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
