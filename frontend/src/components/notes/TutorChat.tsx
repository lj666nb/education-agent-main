import React, { useState, useRef, useEffect, useCallback } from 'react'
import { notesTutorApi, type TutorMessage } from '../../api/notesTutor'
import type { NoteChapter, NoteSection } from './ds-notes'

interface TutorChatProps {
  chapter: NoteChapter | null
  section: NoteSection | null
}

export default function TutorChat({ chapter, section }: TutorChatProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<TutorMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: TutorMessage = { role: 'user', content: text }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await notesTutorApi.ask({
        message: text,
        chapter_title: chapter?.title ?? null,
        section_title: section?.title ?? null,
        section_content: section?.content ?? null,
        conversation_history: messages,
      })
      setMessages([...updated, { role: 'assistant', content: res.reply }])
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || '请求失败'
      setError(detail)
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, chapter, section])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(!open)}
        title={open ? '关闭 AI 导师' : 'AI 编程导师'}
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          zIndex: 400,
          width: 50,
          height: 50,
          borderRadius: '50%',
          border: 'none',
          background: open ? '#EF4444' : 'var(--ds-accent, #0369A1)',
          color: '#fff',
          fontSize: 22,
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(3,105,161,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.08)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 92,
            right: 28,
            zIndex: 399,
            width: 380,
            height: 520,
            background: '#fff',
            borderRadius: 14,
            boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
            border: '1px solid var(--ds-border, #e8e8ec)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'tutorSlideUp 0.25s ease',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--ds-border, #e8e8ec)',
              background: 'var(--ds-accent, #0369A1)',
              color: '#fff',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              🤖 AI 编程导师
            </div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
              苏格拉底式引导教学 · 当前：
              {section ? `《${section.title}》` : chapter ? `《${chapter.title}》` : '数据结构笔记'}
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {messages.length === 0 && !loading && (
              <div style={{ textAlign: 'center', color: 'var(--ds-text-muted, #888)', fontSize: 12, padding: '20px 8px' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
                <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--ds-text-primary, #1a1a2e)' }}>
                  你好！我是你的 AI 编程导师
                </div>
                <div style={{ lineHeight: 1.6 }}>
                  你可以向我提问当前章节的任何问题 💡<br />
                  我会用引导的方式帮你理解，而不是直接给答案 ✨
                </div>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {['这个数据结构怎么理解？', '能给我一个代码示例吗？', '时间复杂度怎么分析？'].map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(q)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--ds-border, #e8e8ec)',
                        background: '#fff',
                        color: 'var(--ds-accent, #0369A1)',
                        fontSize: 11,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        textAlign: 'left',
                      }}
                    >
                      💬 {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  background: msg.role === 'user' ? 'var(--ds-accent, #0369A1)' : '#f3f4f6',
                  color: msg.role === 'user' ? '#fff' : 'var(--ds-text-primary, #1a1a2e)',
                  fontSize: 12.5,
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {msg.content}
              </div>
            ))}

            {loading && (
              <div style={{ alignSelf: 'flex-start', padding: '8px 12px', borderRadius: 12, background: '#f3f4f6', fontSize: 12 }}>
                <span style={{ display: 'inline-flex', gap: 3 }}>
                  <span style={{ animation: 'tutorDot 1.2s infinite' }}>●</span>
                  <span style={{ animation: 'tutorDot 1.2s 0.2s infinite' }}>●</span>
                  <span style={{ animation: 'tutorDot 1.2s 0.4s infinite' }}>●</span>
                </span>
              </div>
            )}

            {error && (
              <div style={{ alignSelf: 'center', padding: '6px 12px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 11 }}>
                ⚠️ {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: '10px 14px',
              borderTop: '1px solid var(--ds-border, #e8e8ec)',
              display: 'flex',
              gap: 8,
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的问题..."
              disabled={loading}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--ds-border, #e8e8ec)',
                fontSize: 12.5,
                outline: 'none',
                fontFamily: 'inherit',
                color: 'var(--ds-text-primary, #1a1a2e)',
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: loading || !input.trim() ? '#d1d5db' : 'var(--ds-accent, #0369A1)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              发送
            </button>
          </div>
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes tutorSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tutorDot {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </>
  )
}
