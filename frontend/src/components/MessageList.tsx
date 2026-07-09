import { useEffect, useRef, useState, useCallback } from 'react'
import { RefreshCw, Volume2, Copy, Brain, Download, ChevronDown, FileText, FileUp, Play, BarChart3, GitBranch, Link } from 'lucide-react'
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

  // ── Icon-only button style ──
  const iconBtnStyle: React.CSSProperties = {
    padding: '6px',
    border: '2px solid transparent',
    background: 'none',
    color: 'var(--gray-400)',
    cursor: 'pointer',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.15s, background-color 0.15s, border-color 0.3s',
  }

  // ── SpeakingManager ──
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const handleSpeak = useCallback((msgId: string, content: string) => {
    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel()
      setSpeakingMsgId(null)
      return
    }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(content.replace(/[#*`~\[\]()>!\[\]]/g, ''))
    u.lang = 'zh-CN'
    u.rate = 1.0
    u.onend = () => setSpeakingMsgId(null)
    u.onerror = () => setSpeakingMsgId(null)
    utteranceRef.current = u
    setSpeakingMsgId(msgId)
    window.speechSynthesis.speak(u)
  }, [speakingMsgId])

  // cleanup on unmount
  useEffect(() => { return () => window.speechSynthesis.cancel() }, [])

  // ── Export logic ──
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
                      <Copy size={12} />
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
                      <Play size={12} fill="currentColor" />
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
                        <BarChart3 size={12} />
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

  // ── Empty state ──
  if (messages.length === 0 && !isLoading) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px 24px',
      }}>
        <h1 style={{
          fontSize: '1.75rem', fontWeight: 700,
          color: 'var(--gray-800)',
          fontFamily: 'var(--font-heading)',
          marginBottom: '8px',
          letterSpacing: '-0.02em',
        }}>
          开始新对话
        </h1>
        <p style={{
          fontSize: '0.9375rem', color: 'var(--gray-500)',
          marginBottom: '40px',
        }}>
          选择模型并开始对话，支持 DeepSeek 和 Qwen
        </p>

        {/* Feature cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px', maxWidth: '640px', width: '100%',
        }}>
          {[
            { icon: FileUp, title: '文件上传', desc: '支持 PDF、Word、PPT' },
            { icon: Play, title: '代码运行', desc: 'Python 代码在线执行' },
            { icon: BarChart3, title: '图表生成', desc: 'AI 自动绘制各类图表' },
            { icon: GitBranch, title: '思维导图', desc: '知识结构可视化' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="feature-card-hover" style={{
              padding: '20px', borderRadius: '12px',
              backgroundColor: '#FFFFFF', border: '1px solid #F0F0F0',
              boxShadow: 'var(--chat-bubble-ai-shadow)',
              textAlign: 'center',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--primary)'
              e.currentTarget.style.boxShadow = '0 0 0 3px oklch(0.55 0.18 200 / 0.1), 0 4px 12px rgba(0,0,0,0.06)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#F0F0F0'
              e.currentTarget.style.boxShadow = 'var(--chat-bubble-ai-shadow)'
            }}
            >
              <div style={{ marginBottom: '12px', color: 'var(--primary)' }}>
                <Icon size={28} />
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--gray-700)', marginBottom: '4px' }}>
                {title}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
                {desc}
              </div>
            </div>
          ))}
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
          className="chat-message-enter"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
            marginBottom: 'var(--space-4)',
            position: 'relative',
          }}
        >
          {/* Message bubble */}
          <div
            style={message.role === 'user' ? {
              maxWidth: '70%',
              padding: '14px 20px',
              borderRadius: '16px 16px 4px 16px',
              background: 'var(--chat-bubble-user-bg)',
              color: '#FFFFFF',
              wordBreak: 'break-word',
              lineHeight: 1.6,
              fontSize: '0.9375rem',
            } : {
              maxWidth: '85%',
              padding: '20px 24px',
              borderRadius: '12px 12px 12px 4px',
              backgroundColor: 'var(--chat-bubble-ai-bg)',
              border: '1px solid var(--chat-bubble-ai-border)',
              boxShadow: 'var(--chat-bubble-ai-shadow)',
              color: 'var(--gray-800)',
              wordBreak: 'break-word',
              lineHeight: 1.7,
              fontSize: '0.9375rem',
            }}
          >
            {/* Reasoning / thinking section */}
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
                      <Brain size={16} /> AI 深度思考中，请稍候...
                    </div>
                  </div>
                ) : (
                  <details>
                    <summary style={{ cursor: 'pointer', color: 'var(--gray-500)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Brain size={16} /> 深度思考（点击查看）
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

            {/* Content segments (text, SVG, plot, diagram) */}
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

            {/* Sources (RAG) */}
            {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
              <details style={{ marginTop: 'var(--space-3)', fontSize: '0.8125rem' }}>
                <summary style={{ cursor: 'pointer', color: 'var(--gray-400)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 'var(--space-1)', userSelect: 'none' }}>
                  <FileText size={14} />
                  <Link size={12} /> 参考来源（{message.sources.length} 项）
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
                        <FileText size={12} />
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

          {/* Icon-only action buttons for AI messages */}
          {message.role === 'assistant' && !isLoading && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              marginTop: '14px', paddingTop: '12px',
              borderTop: '1px solid var(--gray-100)',
              width: '100%',
            }}>
              {/* 重新生成 */}
              {onRollback && (
                <button
                  onClick={() => onRollback(message.id)}
                  title="重新生成"
                  style={iconBtnStyle}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'oklch(0.55 0.18 200 / 0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <RefreshCw size={15} />
                </button>
              )}
              {/* 朗读 */}
              <button
                onClick={() => handleSpeak(message.id, message.content)}
                title={speakingMsgId === message.id ? '停止朗读' : '朗读'}
                style={{
                  ...iconBtnStyle,
                  color: speakingMsgId === message.id ? 'var(--primary)' : 'var(--gray-400)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'oklch(0.55 0.18 200 / 0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <Volume2 size={15} />
              </button>
              {/* 复制 */}
              <button
                onClick={() => navigator.clipboard.writeText(message.content).catch(() => {})}
                title="复制"
                style={iconBtnStyle}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'oklch(0.55 0.18 200 / 0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <Copy size={15} />
              </button>
              {/* 生成思维导图 */}
              {message.content && message.content.length > 20 && onGenerateMindmap && (
                <button
                  onClick={() => onGenerateMindmap(message.id, message.content)}
                  title="生成思维导图"
                  style={iconBtnStyle}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#7C3AED'; e.currentTarget.style.backgroundColor = 'oklch(0.45 0.18 280 / 0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <GitBranch size={15} />
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Loading indicator — 3 bouncing dots */}
      {isLoading && (
        <div className="fade-in" style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '24px' }}>
          <div style={{
            padding: '16px 24px',
            borderRadius: '12px 12px 12px 4px',
            backgroundColor: 'var(--chat-bubble-ai-bg)',
            border: '1px solid var(--chat-bubble-ai-border)',
            boxShadow: 'var(--chat-bubble-ai-shadow)',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <span className="chat-dot-bounce" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--gray-300)' }} />
            <span className="chat-dot-bounce" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--gray-300)' }} />
            <span className="chat-dot-bounce" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--gray-300)' }} />
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
                <Download size={16} />
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
