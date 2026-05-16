import { useEffect, useRef } from 'react'

type Level = 'L1' | 'L2' | 'L3'

interface Message {
  id: string
  conversationId: string
  content: string
  level: Level
  timestamp: number
  role: 'system' | 'assistant' | 'user'
}

const LEVEL_LABELS: Record<Level, string> = {
  L1: '简要思路', L2: '分步详解', L3: '拓展延伸',
}

function formatTime(ts: number) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatContent(text: string) {
  let html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
  return html
}

export default function ChatMessages({
  messages, loading, onFeedback,
}: {
  messages: Message[]
  loading?: boolean
  onFeedback?: (messageId: string, rating: 1 | -1) => void
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {messages.map((msg, i) => (
        <div key={msg.id}>
          {/* System message */}
          {msg.role === 'system' && (
            <div style={{ textAlign: 'center', padding: '10px 16px', background: '#F3F4F6', borderRadius: 14, fontSize: '13px', color: '#6B7280' }}>
              {msg.content}
            </div>
          )}

          {/* User message */}
          {msg.role === 'user' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              <div style={{
                background: '#1E3A8A', color: '#fff', padding: '12px 16px',
                borderRadius: '16px 16px 4px 16px', maxWidth: '85%',
                fontSize: '14px', lineHeight: 1.6,
              }}>
                {msg.content}
              </div>
              <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{formatTime(msg.timestamp)}</span>
            </div>
          )}

          {/* Assistant message */}
          {msg.role === 'assistant' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', padding: '3px 12px', borderRadius: 10, background: 'rgba(30,58,138,0.1)', color: '#1E3A8A', fontWeight: 500 }}>
                  {LEVEL_LABELS[msg.level]}
                </span>
                <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{formatTime(msg.timestamp)}</span>
              </div>
              <div style={{
                background: '#fff', padding: '16px', borderRadius: '16px 16px 16px 4px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)', fontSize: '14px', lineHeight: 1.8, color: '#1F2937',
              }}>
                <div dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }} />
              </div>
              <div style={{ display: 'flex', gap: '12px', paddingLeft: '4px' }}>
                <span style={{ fontSize: '11px', color: '#6B7280', cursor: 'pointer' }}
                  onClick={() => navigator.clipboard.writeText(msg.content)}>
                  复制
                </span>
              </div>
              {/* Feedback */}
              <div style={{ display: 'flex', gap: '12px', paddingLeft: '4px' }}>
                <button onClick={() => onFeedback?.(msg.id, 1)}
                  style={{ fontSize: '11px', padding: '4px 12px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
                  👍 有用
                </button>
                <button onClick={() => onFeedback?.(msg.id, -1)}
                  style={{ fontSize: '11px', padding: '4px 12px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
                  👎 无用
                </button>
              </div>
            </div>
          )}

          {/* Loading dots */}
          {i === messages.length - 1 && loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[0, 1, 2].map(d => (
                  <div key={d} style={{
                    width: 8, height: 8, background: '#1E3A8A', borderRadius: '50%',
                    animation: 'dotPulse 1.4s infinite',
                    animationDelay: `${d * 0.16 - 0.32}s`,
                  }} />
                ))}
              </div>
              <span style={{ fontSize: '12px', color: '#9CA3AF' }}>AI正在思考...</span>
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
