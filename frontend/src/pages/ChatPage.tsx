import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { chatApi, profileV2Api } from '../api'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [collectedInfo, setCollectedInfo] = useState<Record<string, string>>({})
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: string; content: string }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (!hasInitialized.current && messages.length === 0) {
      hasInitialized.current = true
      addSystemMessage('你好！我是你的学习助手。为了更好地了解你的学习情况，我需要了解一些基本信息。让我们开始吧！首先，请告诉我你的专业是什么？')
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addSystemMessage = (content: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
    }])
  }

  const addUserMessage = (content: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userText = input.trim()
    setInput('')
    addUserMessage(userText)
    setIsLoading(true)
    setError('')

    try {
      const newHistory = [...conversationHistory, { role: 'user', content: userText }]

      const response = await chatApi.profileInit({
        message: userText,
        conversation_history: newHistory,
        collected_info: collectedInfo,
      })

      const { reply, collected_info, is_complete } = response.data

      setCollectedInfo(collected_info)
      setConversationHistory([...newHistory, { role: 'assistant', content: reply }])
      addSystemMessage(reply)

      if (is_complete) {
        const cognitiveStyleMap: Record<string, string> = {
          'visual': 'visual',
          'auditory': 'auditory',
          'reading_writing': 'reading_writing',
          'kinesthetic': 'kinesthetic',
          'mixed': 'mixed',
        }

        const cognitiveStyle = cognitiveStyleMap[collected_info.preferredStyle] || 'mixed'

        await profileV2Api.createProfile({
          cognitive_style: cognitiveStyle,
          cognitive_style_confidence: 0.6,
          active_hours: { morning: 0.25, afternoon: 0.25, evening: 0.25, night: 0.25 },
          learning_rhythm_scalar: 0.5,
          learning_rhythm_trend: 0.0,
          metacognitive_calibration: 0.0,
          attention_feature: 0.5,
          knowledge_points: [],
        })

        addSystemMessage('🎉 画像初始化完成！我已根据你的回答生成了个性化学习画像。')
        setTimeout(() => {
          navigate('/profile/dynamic')
        }, 2000)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || '对话失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <button
        onClick={() => navigate('/')}
        style={{
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          padding: '0.5rem 1rem',
          borderRadius: '0.375rem',
          border: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          color: '#374151',
          cursor: 'pointer',
          fontSize: '0.875rem',
          zIndex: 1000,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        ← 首页
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>AI 学习助手对话</h1>
        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          已收集 {Object.keys(collectedInfo).length} / 5 项信息
        </span>
      </div>

      {error && (
        <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '1rem' }}>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1rem' }}>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: '0.75rem',
              }}
            >
              <div style={{
                maxWidth: '70%',
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                backgroundColor: msg.role === 'user' ? '#3b82f6' : '#f3f4f6',
                color: msg.role === 'user' ? 'white' : '#1f2937',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.5',
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '0.75rem' }}>
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                backgroundColor: '#f3f4f6',
                color: '#6b7280',
              }}>
                <span style={{ display: 'inline-block', animation: 'pulse 1.5s infinite' }}>思考中...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            type="text"
            className="input"
            placeholder="输入你的回答..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || !input.trim()}
          >
            发送
          </button>
        </form>
      </div>
    </div>
  )
}
