import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

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
}

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
  enableThinking?: boolean
}

function BotIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
      <rect x="3" y="11" width="18" height="10" rx="2"/>
      <circle cx="12" cy="5" r="2"/>
      <path d="M12 7v4"/>
      <line x1="8" y1="16" x2="8" y2="16"/>
      <line x1="16" y1="16" x2="16" y2="16"/>
    </svg>
  )
}

function BrainIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 1 4 4c0 1.1-.4 2-1 2.7V10c0 1.1-.9 2-2 2s-2-.9-2-2V8.7c-.6-.7-1-1.6-1-2.7a4 4 0 0 1 4-4z"/>
      <path d="M12 14c2.2 0 6 1.1 6 3v2H6v-2c0-1.9 3.8-3 6-3z"/>
    </svg>
  )
}

export default function MessageList({ messages, isLoading, enableThinking = false }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  const renderMessageContent = (content: string) => {
    return (
      <ReactMarkdown
        components={{
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const isInline = !match && !className

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
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={match ? match[1] : 'text'}
                PreTag="div"
                customStyle={{
                  margin: '1rem 0',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                }}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
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
        color: 'var(--gray-400)',
        padding: 'var(--space-8)',
      }}>
        <BotIcon />
        <div style={{ fontSize: '1.25rem', marginTop: 'var(--space-4)', marginBottom: 'var(--space-2)', color: 'var(--gray-700)', fontFamily: 'var(--font-heading)' }}>
          开始新对话
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--gray-400)' }}>
          选择模型并开始对话，支持 DeepSeek 和 Qwen
        </div>
      </div>
    )
  }

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: 'var(--space-4)',
      backgroundColor: 'white',
      minHeight: 0,
    }}>
      {messages.map((message) => (
        <div
          key={message.id}
          className="fade-in"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
            marginBottom: 'var(--space-4)',
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
                      <BrainIcon /> 深度思考中...
                    </div>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.reasoning_content}</ReactMarkdown>
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
            {renderMessageContent(message.content)}

            {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
              <details style={{ marginTop: 'var(--space-3)', fontSize: '0.8125rem' }}>
                <summary style={{ cursor: 'pointer', color: 'var(--gray-400)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 'var(--space-1)', userSelect: 'none' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  📎 参考来源（{message.sources.length} 项）
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
          }}>
            <span style={{ display: 'flex', gap: '4px' }}>
              <span style={{ animation: 'pulse 1.5s infinite', animationDelay: '0ms' }}>·</span>
              <span style={{ animation: 'pulse 1.5s infinite', animationDelay: '300ms' }}>·</span>
              <span style={{ animation: 'pulse 1.5s infinite', animationDelay: '600ms' }}>·</span>
            </span>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}
