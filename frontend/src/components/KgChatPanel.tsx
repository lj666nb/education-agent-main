/**
 * KgChatPanel — 知识图谱 RAG 智能问答面板
 *
 * 在知识图谱可视化弹窗中提供 AI 问答能力。
 * 使用 SSE 流式接收后端的检索+生成结果，实时展示。
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { knowledgeGraphApi, type ChatMessage, type SSEEvent } from '../api/knowledgeGraph'

const BRAND_COLOR = '#1677E8'

interface Props {
  subjectId: string
  subjectName: string
  onHighlightNodes?: (nodeNames: string[]) => void
}

export default function KgChatPanel({ subjectId, subjectName, onHighlightNodes }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [streamingContent, setStreamingContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, statusMsg])

  const handleSend = useCallback(async () => {
    const q = input.trim()
    if (!q || loading) return

    setInput('')
    setLoading(true)
    setStreamingContent('')
    setStatusMsg('正在搜索知识图谱...')

    const userMsg: ChatMessage = { role: 'user', content: q }
    const msgs = [...messages, userMsg]
    setMessages(msgs)

    abortRef.current = knowledgeGraphApi.streamChat(
      subjectId,
      q,
      messages,
      (event: SSEEvent) => {
        switch (event.phase) {
          case 'searching':
            setStatusMsg(event.message || '')
            break
          case 'nodes_found':
            setStatusMsg(`找到 ${event.node_titles?.length || 0} 个相关知识点`)
            if (onHighlightNodes && event.node_titles) {
              onHighlightNodes(event.node_titles)
            }
            break
          case 'generating':
            setStatusMsg(event.message || '正在生成答案...')
            break
          case 'answer_chunk':
            setStatusMsg('')
            setStreamingContent(prev => prev + (event.content || ''))
            break
          case 'done':
            setStatusMsg('')
            const finalContent = event.full_answer || streamingContent
            const referenced = event.referenced_nodes || []
            setStreamingContent('')
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: finalContent,
              referencedNodes: referenced,
            }])
            setLoading(false)
            break
          case 'error':
            setStatusMsg('')
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `❌ ${event.message || '请求失败，请重试'}`,
            }])
            setStreamingContent('')
            setLoading(false)
            break
        }
      },
      () => {
        setLoading(false)
      },
      (error: Error) => {
        setStatusMsg('')
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ ${error.message || '请求失败，请重试'}`,
        }])
        setStreamingContent('')
        setLoading(false)
      },
    )
  }, [input, loading, messages, subjectId, streamingContent, onHighlightNodes])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
    setLoading(false)
    setStatusMsg('')
    if (streamingContent) {
      setMessages(prev => [...prev, { role: 'assistant', content: streamingContent }])
      setStreamingContent('')
    }
  }

  const handleClear = () => {
    setMessages([])
    setStreamingContent('')
    setStatusMsg('')
  }

  const suggestedQuestions = [
    `"${subjectName}"包含哪些核心知识点？`,
    '这个知识图谱的主要关系是什么？',
    '有哪些基础内容需要先学习？',
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#FAFAFA' }}>
      {/* 消息列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>
              向 AI 提问关于"{subjectName}"知识图谱的问题
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q)}
                  style={{
                    padding: '6px 14px', borderRadius: 16, border: '1px solid #E5E7EB',
                    background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer',
                    fontFamily: 'inherit', maxWidth: '90%',
                  }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex', flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%', padding: '10px 14px', borderRadius: 12,
                  background: msg.role === 'user' ? BRAND_COLOR : '#fff',
                  color: msg.role === 'user' ? '#fff' : '#1F2937',
                  fontSize: 13, lineHeight: 1.55,
                  border: msg.role === 'assistant' ? '1px solid #E5E7EB' : 'none',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, opacity: 0.7 }}>
                    {msg.role === 'user' ? '你' : 'AI 助手'}
                  </div>
                  {msg.content}
                </div>
                {msg.referencedNodes && msg.referencedNodes.length > 0 && (
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, marginLeft: 4 }}>
                    📎 引用: {msg.referencedNodes.slice(0, 5).join(', ')}
                    {msg.referencedNodes.length > 5 ? ` +${msg.referencedNodes.length - 5}` : ''}
                  </div>
                )}
              </div>
            ))}

            {/* 流式输出中的内容 */}
            {loading && streamingContent && (
              <div style={{
                maxWidth: '85%', padding: '10px 14px', borderRadius: 12,
                background: '#fff', border: `1px solid ${BRAND_COLOR}40`,
                fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: BRAND_COLOR }}>
                  AI 助手正在回答...
                </div>
                {streamingContent}
                <span style={{
                  display: 'inline-block', width: 8, height: 14,
                  background: BRAND_COLOR, animation: 'kg-cursor-blink 0.8s infinite',
                  marginLeft: 1, verticalAlign: 'text-bottom',
                }} />
              </div>
            )}

            {/* 搜索状态 */}
            {loading && !streamingContent && statusMsg && (
              <div style={{
                maxWidth: '85%', padding: '8px 14px', borderRadius: 12,
                background: '#F0F9FF', fontSize: 12, color: '#6B7280',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{
                  width: 14, height: 14, border: `2px solid #E5E7EB`,
                  borderTopColor: BRAND_COLOR, borderRadius: '50%',
                  animation: 'kg-spin 0.8s linear infinite',
                }} />
                {statusMsg}
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div style={{
        padding: '10px 16px', borderTop: '1px solid #E5E7EB',
        background: '#fff', display: 'flex', gap: 8, alignItems: 'center',
      }}>
        {messages.length > 0 && (
          <button onClick={handleClear} title="清空对话"
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: 'transparent', color: '#9CA3AF', cursor: 'pointer',
              fontSize: 16, flexShrink: 0,
            }}>
            🗑
          </button>
        )}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="提问关于知识图谱的问题..."
          disabled={loading}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 10,
            border: '1px solid #E5E7EB', fontSize: 13, outline: 'none',
            background: loading ? '#F9FAFB' : '#fff',
            fontFamily: 'inherit',
          }}
        />
        {loading ? (
          <button onClick={handleStop}
            style={{
              padding: '6px 14px', borderRadius: 10, border: 'none',
              background: '#EF4444', color: '#fff', fontSize: 12, cursor: 'pointer',
              fontWeight: 500, flexShrink: 0,
            }}>
            停止
          </button>
        ) : (
          <button onClick={handleSend} disabled={!input.trim()}
            style={{
              padding: '6px 14px', borderRadius: 10, border: 'none',
              background: input.trim() ? BRAND_COLOR : '#D1D5DB',
              color: '#fff', fontSize: 12, cursor: input.trim() ? 'pointer' : 'not-allowed',
              fontWeight: 500, flexShrink: 0,
            }}>
            发送
          </button>
        )}
      </div>

      <style>{`
        @keyframes kg-spin { to { transform: rotate(360deg); } }
        @keyframes kg-cursor-blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  )
}
