import { useState, useEffect } from 'react'
import LayerSwitcher from './LayerSwitcher'
import ChatMessages from './ChatMessages'
import ChatInputArea from './ChatInputArea'

type Level = 'L1' | 'L2' | 'L3'

interface Message {
  id: string
  conversationId: string
  content: string
  level: Level
  timestamp: number
  role: 'system' | 'assistant' | 'user'
}

/** Mock responses for different levels */
function generateMockReply(questionId: string, userMsg: string, level: Level): Message {
  const replies: Record<Level, string> = {
    L1: `**简要思路**：\n\n这个问题可以从以下关键点入手：\n1. 理解题目的核心要求\n2. 运用相关的基本概念和公式\n3. 注意易错点和边界情况\n\n如果需要更详细的解释，请切换到"分步详解"。`,
    L2: `**分步详解**：\n\n让我逐步解释：\n\n1. **第一步**：分析题目已知条件\n   ${userMsg}\n\n2. **第二步**：运用相关知识点\n   这涉及到该题的核心概念\n\n3. **第三步**：逐步推导\n   按照逻辑顺序得出结论\n\n4. **第四步**：验证答案\n   检查每一步是否合理`,
    L3: `**拓展延伸**：\n\n除了基本解法，我们还可以从以下角度深入理解：\n\n**知识点拓展**：\n- 相关的定理和公式推导\n- 常见解题技巧总结\n- 易错点分析\n\n**举一反三**：\n尝试将此方法应用到类似问题中。`,
  }

  return {
    id: `msg_${Date.now()}`,
    conversationId: `conv_${questionId}`,
    content: replies[level] || replies.L2,
    level,
    timestamp: Date.now(),
    role: 'assistant',
  }
}

function generateWelcome(questionId: string): Message {
  return {
    id: `msg_welcome_${Date.now()}`,
    conversationId: `conv_${questionId}`,
    content: '你好！我来帮你解答这道题目。你可以选择不同的解答层级，或输入你的具体问题。',
    level: 'L2',
    timestamp: Date.now(),
    role: 'system',
  }
}

export default function ChatPanel({
  visible, questionId, recommendedLevel = 'L2', onClose,
}: {
  visible: boolean
  questionId: string
  recommendedLevel?: Level
  onClose: () => void
}) {
  const [currentLevel, setCurrentLevel] = useState<Level>(recommendedLevel)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible) {
      setCurrentLevel(recommendedLevel)
      setMessages([generateWelcome(questionId)])
    }
  }, [visible, questionId, recommendedLevel])

  const handleLevelChange = (level: Level) => {
    if (level === currentLevel) return
    setCurrentLevel(level)
    setLoading(true)
    setTimeout(() => {
      setMessages(prev => [...prev, generateMockReply(questionId, '', level)])
      setLoading(false)
    }, 800)
  }

  const handleSendMessage = (text: string) => {
    const userMsg: Message = {
      id: `msg_user_${Date.now()}`,
      conversationId: `conv_${questionId}`,
      content: text,
      level: currentLevel,
      timestamp: Date.now(),
      role: 'user',
    }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    setTimeout(() => {
      setMessages(prev => [...prev, generateMockReply(questionId, text, currentLevel)])
      setLoading(false)
    }, 1000)
  }

  const handleFeedback = (messageId: string, rating: 1 | -1) => {
    // Mock feedback - would call API in production
    console.log(`Feedback: message=${messageId}, rating=${rating}`)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '70vh', background: '#F9FAFB',
        borderRadius: '24px 24px 0 0',
        display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.3s ease-out',
        // Desktop: side panel
        ...(window.innerWidth >= 768 ? {
          left: 'auto', right: 0, width: '50%', height: '100%', borderRadius: 0,
        } : {}),
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', background: '#fff',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '17px', fontWeight: 600, color: '#1F2937' }}>智能答疑</span>
            <span style={{ fontSize: '11px', padding: '3px 12px', background: 'rgba(30,58,138,0.1)', color: '#1E3A8A', borderRadius: 10 }}>
              题目 #{questionId.slice(0, 8)}
            </span>
          </div>
          <button onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: '50%', background: '#F3F4F6', border: 'none', fontSize: '14px', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
        </div>

        {/* Layer Switcher */}
        <div style={{ padding: '12px 16px', background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
          <LayerSwitcher currentLevel={currentLevel} recommendedLevel={recommendedLevel} onSelect={handleLevelChange} />
        </div>

        {/* Messages */}
        <ChatMessages messages={messages} loading={loading} onFeedback={handleFeedback} />

        {/* Input */}
        <ChatInputArea onSend={handleSendMessage} />
      </div>
    </div>
  )
}
