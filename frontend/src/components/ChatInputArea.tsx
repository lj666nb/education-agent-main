import { useState } from 'react'

const QUICK_QUESTIONS = [
  '能再解释一下吗？',
  '这道题的考点是什么？',
  '有没有类似的题目？',
]

export default function ChatInputArea({ onSend }: { onSend: (message: string) => void }) {
  const [text, setText] = useState('')

  const handleSend = () => {
    if (text.trim()) {
      onSend(text.trim())
      setText('')
    }
  }

  return (
    <div style={{ padding: '14px 16px', background: '#fff', borderTop: '1px solid #E5E7EB' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        {QUICK_QUESTIONS.map(q => (
          <span key={q} onClick={() => onSend(q)}
            style={{ padding: '6px 14px', background: '#F3F4F6', borderRadius: 16, fontSize: '12px', color: '#6B7280', cursor: 'pointer' }}>
            {q}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
        <textarea
          value={text} onChange={e => setText(e.target.value)}
          placeholder="输入你的问题..."
          maxLength={500}
          rows={1}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          style={{
            flex: 1, minHeight: 40, maxHeight: 80, padding: '10px 16px',
            background: '#F3F4F6', borderRadius: 20, border: 'none', outline: 'none',
            fontSize: '14px', fontFamily: 'inherit', resize: 'none',
          }}
        />
        <button onClick={handleSend} disabled={!text.trim()}
          style={{
            padding: '10px 20px', borderRadius: 20, border: 'none',
            background: text.trim() ? '#1E3A8A' : '#9CA3AF', color: '#fff',
            fontSize: '13px', fontWeight: 500, cursor: text.trim() ? 'pointer' : 'default',
          }}>
          发送
        </button>
      </div>
    </div>
  )
}
