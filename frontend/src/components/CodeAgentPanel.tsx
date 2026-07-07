import { useState, useRef, useEffect, useCallback } from 'react'

/* ── Types ── */
interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface CodeAgentPanelProps {
  code: string
  language: string
  onApplyCode: (newCode: string) => void
  /** 代码运行出错时传入的输出内容（stderr / exitCode != 0） */
  errorOutput?: string
  /** 是否有错误需要自动修复 */
  hasError?: boolean
}

/* ── Preset action config ── */
interface PresetAction {
  id: string
  label: string
  shortLabel: string
  icon: string
  prompt: string
}

const PRESET_ACTIONS: PresetAction[] = [
  {
    id: 'comment',
    label: '添加注释',
    shortLabel: '注释',
    icon: '//',
    prompt: '请为以下代码添加详细的中文注释。解释每个函数、类、关键变量的作用，以及核心逻辑的实现思路。保持原有代码不变，仅在关键位置上方添加注释。',
  },
  {
    id: 'optimize',
    label: '优化代码',
    shortLabel: '优化',
    icon: '→',
    prompt: '请优化以下代码，提升可读性、性能和代码质量。保持功能完全不变，仅优化结构和写法。可以使用更现代的语法特性。',
  },
  {
    id: 'fix',
    label: '修复问题',
    shortLabel: '修复',
    icon: '!',
    prompt: '请检查以下代码中可能的错误、bug 或逻辑问题，并修复它们。请说明你发现了什么问题以及如何修复的。',
  },
  {
    id: 'error-handling',
    label: '添加错误处理',
    shortLabel: '错误处理',
    icon: '&',
    prompt: '请为以下代码添加完善的错误处理和异常捕获机制。包括输入验证、异常捕获、错误提示等。',
  },
]

/* ── System prompt for code agent ── */
const SYSTEM_PROMPT = `你是一个专业的代码助手。你的任务是帮助用户修改和优化代码。

**规则：**
1. 仔细阅读用户提供的代码和修改要求
2. 返回完整的修改后代码（不是片段）
3. 用代码块 \`\`\`包裹返回的完整代码，并标注语言
4. 在代码块之前用中文简要说明你做了哪些修改
5. 保留原代码的所有功能，只做用户要求的改动

**输出格式示例：**
我做了以下修改：
- 添加了函数注释
- 优化了变量命名

\`\`\`python
def hello():
    # 打印问候
    print("Hello")
\`\`\``

/* ── Local SVG Icons ── */
function SendIcon() { return (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)}

function ApplyIcon() { return (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)}

function CodeIcon() { return (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
  </svg>
)}

function RobotIcon() { return (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8" y2="16" /><line x1="16" y1="16" x2="16" y2="16" />
  </svg>
)}

/* ── Extract code from AI response ── */
function extractCodeBlock(text: string): string | null {
  const match = text.match(/```[\w]*\n([\s\S]*?)```/)
  return match ? match[1].trim() : null
}

/* ── Language comment style ── */
function getCommentPrefix(lang: string): string {
  switch (lang) {
    case 'python': return '#'
    case 'java':
    case 'c':
    case 'cpp':
    case 'javascript':
    case 'typescript':
    case 'go':
    case 'rust':
    case 'csharp': return '//'
    case 'html': return '<!--'
    case 'css': return '/*'
    case 'sql': return '--'
    default: return '#'
  }
}

/* ════════════════════════════════════════
   CodeAgentPanel Component
   ════════════════════════════════════════ */
export default function CodeAgentPanel({ code, language, onApplyCode, errorOutput, hasError }: CodeAgentPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [autoFixLoading, setAutoFixLoading] = useState(false)
  const [responseText, setResponseText] = useState('')
  const [extractedCode, setExtractedCode] = useState<string | null>(null)
  const [lastApplied, setLastApplied] = useState<string | null>(null)
  const responseRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [showHistory, setShowHistory] = useState(false)
  const prevHasErrorRef = useRef(false)

  const commentPrefix = getCommentPrefix(language)

  /* Auto-scroll response */
  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight
    }
  }, [responseText])

  /* Detect new error → prompt auto-fix */
  useEffect(() => {
    if (hasError && !prevHasErrorRef.current) {
      // Error just appeared — show a hint in the panel
      setResponseText('')
      setExtractedCode(null)
    }
    prevHasErrorRef.current = !!hasError
  }, [hasError])

  /* Send instruction to AI */
  const sendToAI = useCallback(async (instruction: string) => {
    if (!code.trim() || loading) return

    setLoading(true)
    setResponseText('')
    setExtractedCode(null)
    setLastApplied(null)
    setShowHistory(false)

    const userMsg: ChatMessage = { role: 'user', content: `语言：${language}\n\n当前代码：\n\`\`\`${language}\n${code}\n\`\`\`\n\n要求：${instruction}` }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)

    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          model: 'qwen3.5-plus',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...updatedMessages.slice(-6).map(m => ({ role: m.role, content: m.content })),
          ],
          stream: false,
          temperature: 0.3,
          max_tokens: 4096,
        }),
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        let detail = `服务器错误 (${response.status})`
        try { const j = JSON.parse(errText); detail = j.detail || detail } catch {}
        throw new Error(detail)
      }

      const result = await response.json()
      const reply = result.message?.content || result.choices?.[0]?.message?.content || ''
      const codeBlock = extractCodeBlock(reply)

      setResponseText(reply)
      setExtractedCode(codeBlock)
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      setShowHistory(true)
    } catch (err: any) {
      setResponseText(`请求失败：${err.message}`)
      setMessages(prev => [...prev, { role: 'assistant', content: `请求失败：${err.message}` }])
    } finally {
      setLoading(false)
    }
  }, [code, language, loading])

  /* Handle preset action */
  const handlePreset = useCallback((action: PresetAction) => {
    sendToAI(action.prompt)
  }, [sendToAI])

  /* Auto-fix: send code + error to AI */
  const autoFixCode = useCallback(async () => {
    if (!code.trim() || !errorOutput || loading || autoFixLoading) return

    setAutoFixLoading(true)
    setResponseText('')
    setExtractedCode(null)
    setLastApplied(null)
    setShowHistory(false)

    const instruction = `以下代码运行时报错，请分析错误原因并修复代码。\n\n错误输出：\n\`\`\`\n${errorOutput}\n\`\`\``
    const userMsg: ChatMessage = { role: 'user', content: `语言：${language}\n\n当前代码：\n\`\`\`${language}\n${code}\n\`\`\`\n\n要求：${instruction}` }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)

    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          model: 'qwen3.5-plus',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...updatedMessages.slice(-6).map(m => ({ role: m.role, content: m.content })),
          ],
          stream: false,
          temperature: 0.3,
          max_tokens: 4096,
        }),
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        let detail = `服务器错误 (${response.status})`
        try { const j = JSON.parse(errText); detail = j.detail || detail } catch {}
        throw new Error(detail)
      }

      const result = await response.json()
      const reply = result.message?.content || result.choices?.[0]?.message?.content || ''
      const codeBlock = extractCodeBlock(reply)

      setResponseText(reply)
      setExtractedCode(codeBlock)
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      setShowHistory(true)
    } catch (err: any) {
      setResponseText(`自动修复失败：${err.message}`)
      setMessages(prev => [...prev, { role: 'assistant', content: `自动修复失败：${err.message}` }])
    } finally {
      setAutoFixLoading(false)
    }
  }, [code, language, errorOutput, messages, loading, autoFixLoading])

  /* Handle custom instruction */
  const handleCustomSend = useCallback(() => {
    if (!input.trim() || loading) return
    sendToAI(input.trim())
    setInput('')
  }, [input, loading, sendToAI])

  /* Handle key press in textarea */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCustomSend()
    }
  }

  /* Apply extracted code to editor */
  const handleApplyCode = useCallback(() => {
    if (extractedCode) {
      onApplyCode(extractedCode)
      setLastApplied(extractedCode)
    }
  }, [extractedCode, onApplyCode])

  /* Reset panel */
  const handleReset = useCallback(() => {
    setMessages([])
    setResponseText('')
    setExtractedCode(null)
    setLastApplied(null)
    setInput('')
    setShowHistory(false)
    setAutoFixLoading(false)
  }, [])

  const codeLineCount = code.split('\n').length

  return (
    <div style={{
      width: 340, height: '100%', display: 'flex', flexDirection: 'column',
      borderLeft: '1px solid #E5E7EB', background: '#FAFAFA',
      fontFamily: "'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif",
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '12px 14px', borderBottom: '1px solid #E5E7EB',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RobotIcon />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1F2937' }}>
            AI 代码助手
          </span>
        </div>
        <button
          onClick={handleReset}
          style={{
            background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer',
            fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4,
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          title="清空对话"
        >
          清空
        </button>
      </div>

      {/* ── Code info bar ── */}
      <div style={{
        padding: '6px 14px', fontSize: '0.7rem', color: '#9CA3AF',
        borderBottom: '1px solid #E5E7EB', background: '#fff',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <CodeIcon />
        <span>{language.toUpperCase()} · {codeLineCount} 行</span>
        {codeLineCount > 0 && (
          <span style={{ color: '#D1D5DB' }}>|</span>
        )}
        {codeLineCount > 0 && (
          <span style={{ color: extractedCode ? '#10B981' : '#9CA3AF' }}>
            {extractedCode ? '有未应用的修改' : '暂无修改'}
          </span>
        )}
      </div>

      {/* ── Preset action buttons ── */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid #E5E7EB',
        display: 'flex', flexWrap: 'wrap', gap: 6,
      }}>
        {PRESET_ACTIONS.map(action => (
          <button
            key={action.id}
            onClick={() => handlePreset(action)}
            disabled={loading || !code.trim()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 6,
              border: '1px solid #E5E7EB',
              background: '#fff', color: '#374151',
              fontSize: '0.75rem', fontWeight: 500,
              cursor: (loading || !code.trim()) ? 'not-allowed' : 'pointer',
              opacity: (loading || !code.trim()) ? 0.5 : 1,
              transition: 'all 0.15s ease',
              fontFamily: 'inherit',
            }}
            title={action.prompt}
            onMouseEnter={e => {
              if (!loading && code.trim()) {
                e.currentTarget.style.borderColor = '#1677E8'
                e.currentTarget.style.color = '#1677E8'
                e.currentTarget.style.background = '#F0F9FF'
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#E5E7EB'
              e.currentTarget.style.color = '#374151'
              e.currentTarget.style.background = '#fff'
            }}
          >
            <span style={{
              fontSize: '0.6rem', fontWeight: 700, color: '#1677E8',
              background: '#F0F9FF', padding: '1px 4px', borderRadius: 3,
            }}>
              {action.icon}
            </span>
            {action.shortLabel}
          </button>
        ))}
      </div>

      {/* ── Error auto-fix banner ── */}
      {hasError && !responseText && !loading && !autoFixLoading && (
        <div style={{
          margin: '8px 14px 0', padding: '10px 12px',
          background: '#FEF2F2', borderRadius: 8,
          border: '1px solid #FECACA',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: '0.9rem' }}>⚠️</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#DC2626' }}>
              代码运行出错
            </span>
          </div>
          <div style={{
            fontSize: '0.7rem', color: '#9CA3AF', marginBottom: 8,
            maxHeight: 60, overflow: 'hidden',
            fontFamily: 'monospace', whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {errorOutput?.slice(0, 200)}
            {(errorOutput?.length || 0) > 200 ? '...' : ''}
          </div>
          <button
            onClick={autoFixCode}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 6, width: '100%',
              padding: '7px 16px', borderRadius: 6, border: 'none',
              background: '#DC2626', color: '#fff',
              fontSize: '0.78rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#B91C1C' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#DC2626' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            AI 自动修复错误
          </button>
        </div>
      )}

      {/* ── Response area ── */}
      <div ref={responseRef} style={{
        flex: 1, overflowY: 'auto', padding: '10px 14px',
        minHeight: 0,
      }}>
        {!responseText && !loading && !autoFixLoading && !hasError && (
          <div style={{
            textAlign: 'center', padding: '30px 10px', color: '#9CA3AF',
            fontSize: '0.78rem', lineHeight: 1.8,
          }}>
            <RobotIcon />
            <div style={{ marginTop: 8 }}>选择一个操作或输入指令</div>
            <div style={{ fontSize: '0.7rem', color: '#D1D5DB' }}>
              AI 将根据当前代码生成修改建议
            </div>
          </div>
        )}

        {!responseText && !loading && !autoFixLoading && !hasError && (
          <div style={{ marginTop: 8, padding: '8px 10px', background: '#FFFBEB', borderRadius: 6, border: '1px solid #FDE68A', fontSize: '0.72rem', color: '#92400E', lineHeight: 1.6 }}>
            <strong>提示：</strong>先点击上方的"<strong style={{ color: '#10B981' }}>运行</strong>"按钮执行代码，如果出错 AI 可自动修复。
          </div>
        )}

        {(loading || autoFixLoading) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 14px', background: autoFixLoading ? '#FEF2F2' : '#F0F9FF', borderRadius: 8,
            fontSize: '0.78rem', color: autoFixLoading ? '#DC2626' : '#1677E8', marginBottom: 8,
          }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: autoFixLoading ? '#DC2626' : '#1677E8',
              animation: 'agentPulse 1s ease infinite',
            }} />
            {autoFixLoading ? 'AI 正在分析错误并修复...' : 'AI 正在处理...'}
          </div>
        )}

        {responseText && (
          <div style={{ fontSize: '0.78rem', lineHeight: 1.7, color: '#374151' }}>
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {responseText.split(/```[\w]*\n?/).map((part, i) =>
                i % 2 === 0 ? (
                  <span key={i}>{part}</span>
                ) : null
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Apply button + history toggle ── */}
      {extractedCode && (
        <div style={{
          padding: '8px 14px', borderTop: '1px solid #E5E7EB',
          background: '#fff',
        }}>
          <button
            onClick={handleApplyCode}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 6, width: '100%',
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: '#1677E8', color: '#fff',
              fontSize: '0.8rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#0369A1' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1677E8' }}
          >
            <ApplyIcon />
            应用代码修改
          </button>
          {lastApplied && (
            <div style={{
              textAlign: 'center', fontSize: '0.7rem', color: '#10B981',
              marginTop: 4,
            }}>
              ✓ 已应用修改
            </div>
          )}
        </div>
      )}

      {/* ── History panel (collapsible) ── */}
      {showHistory && messages.length > 2 && (
        <div style={{
          borderTop: '1px solid #E5E7EB', maxHeight: 150, overflowY: 'auto',
          background: '#F9FAFB',
        }}>
          <div style={{ padding: '6px 14px', fontSize: '0.68rem', color: '#9CA3AF', borderBottom: '1px solid #F3F4F6' }}>
            历史对话 ({Math.ceil(messages.length / 2)} 轮)
          </div>
          {messages.map((msg, i) => (
            <div key={i} style={{
              padding: '6px 14px', fontSize: '0.72rem',
              background: msg.role === 'user' ? '#fff' : 'transparent',
              borderBottom: '1px solid #F3F4F6',
              display: 'flex', gap: 6,
            }}>
              <span style={{ fontWeight: 600, color: msg.role === 'user' ? '#1677E8' : '#10B981', flexShrink: 0 }}>
                {msg.role === 'user' ? '你' : 'AI'}:
              </span>
              <span style={{ color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {msg.content.slice(0, 60)}{msg.content.length > 60 ? '...' : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Custom instruction input ── */}
      <div style={{
        padding: '10px 14px', borderTop: '1px solid #E5E7EB',
        background: '#fff', display: 'flex', gap: 8,
        alignItems: 'flex-end',
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入自定义指令... (Enter 发送)"
          rows={2}
          disabled={loading || !code.trim()}
          style={{
            flex: 1, padding: '6px 10px', borderRadius: 6,
            border: '1px solid #D1D5DB', outline: 'none',
            fontSize: '0.75rem', fontFamily: 'inherit',
            resize: 'none', lineHeight: 1.5,
            color: '#374151', background: loading || !code.trim() ? '#F9FAFB' : '#fff',
            opacity: loading || !code.trim() ? 0.6 : 1,
          }}
        />
        <button
          onClick={handleCustomSend}
          disabled={loading || !input.trim() || !code.trim()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 6,
            border: 'none',
            background: (loading || !input.trim() || !code.trim()) ? '#D1D5DB' : '#1677E8',
            color: '#fff', cursor: (loading || !input.trim() || !code.trim()) ? 'default' : 'pointer',
            flexShrink: 0,
          }}
        >
          <SendIcon />
        </button>
      </div>

      {/* ── Inline styles for animation ── */}
      <style>{`
        @keyframes agentPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </div>
  )
}
