import { useState } from 'react'
import MarkdownRenderer from './MarkdownRenderer'

export interface PracticeQuestion {
  id: string
  type: 'single_choice' | 'multiple_choice' | 'fill_blank' | 'true_false' | 'short_answer' | 'programming' | 'essay'
  content: {
    stem: string
    options?: { key: string; text: string }[]
    code_template?: string
  }
  answer: {
    correct_answer: string[]
    explanation: string
  }
  difficulty: string  // 'beginner'|'basic'|'intermediate'|'advanced'|'competition'
  tags: string[]
}

/* ── 题型/难度映射 ── */

const QTYPE_LABELS: Record<string, string> = {
  single_choice: '单选题', multiple_choice: '多选题', fill_blank: '填空题',
  true_false: '判断题', short_answer: '简答题', programming: '编程题', essay: '论述题',
}
const DIFF_LABELS: Record<string, string> = {
  beginner: '入门', basic: '基础', intermediate: '进阶', advanced: '挑战', competition: '竞赛',
}
const DIFF_COLORS: Record<string, string> = {
  beginner: '#10B981', basic: '#3B82F6', intermediate: '#F59E0B', advanced: '#EF4444', competition: '#8B5CF6',
}

export default function QuestionCard({
  question, onSubmit, onAskAI, readonly, hideAnswer,
}: {
  question: PracticeQuestion
  onSubmit: (answer: string, isCorrect: boolean) => void
  onAskAI: () => void
  readonly?: boolean
  hideAnswer?: boolean
}) {
  const [selected, setSelected] = useState<string>('')
  const [selectedMulti, setSelectedMulti] = useState<string[]>([])
  const [textAnswer, setTextAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)

  const q = question
  const diffLabel = DIFF_LABELS[q.difficulty] || q.difficulty
  const diffColor = DIFF_COLORS[q.difficulty] || '#6B7280'

  const checkAnswer = (userAns: string): boolean => {
    const correct = q.answer?.correct_answer || []
    if (!correct.length) return false
    const user = userAns.trim().toUpperCase()
    return correct.some(c => c.trim().toUpperCase() === user)
  }

  const handleSubmit = () => {
    let answer = ''
    if (q.type === 'single_choice') answer = selected
    else if (q.type === 'multiple_choice') answer = selectedMulti.sort().join(',')
    else if (q.type === 'true_false') answer = selected
    else answer = textAnswer

    if (!answer.trim()) return
    const correct = checkAnswer(answer)
    setIsCorrect(correct)
    setSubmitted(true)
    onSubmit(answer, correct)
  }

  const toggleMulti = (key: string) => {
    setSelectedMulti(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const reset = () => {
    setSelected(''); setSelectedMulti([]); setTextAnswer(''); setSubmitted(false)
  }

  return (
    <div>
      {/* Question Card */}
      <div style={{
        background: '#fff', borderRadius: 16, padding: '24px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)', marginBottom: '12px',
      }}>
        {/* Tags row */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', padding: '3px 14px', borderRadius: 12, background: 'rgba(30,58,138,0.1)', color: '#1E3A8A', fontWeight: 500 }}>
            {QTYPE_LABELS[q.type] || q.type}
          </span>
          <span style={{ fontSize: '12px', padding: '3px 14px', borderRadius: 12, background: `${diffColor}18`, color: diffColor, fontWeight: 500 }}>
            {diffLabel}
          </span>
          {q.tags?.map(t => <span key={t} style={{ fontSize: '11px', color: '#9CA3AF' }}>#{t}</span>)}
        </div>

        {/* Question stem */}
        <div style={{ fontSize: '16px', lineHeight: 1.8, color: '#1F2937', marginBottom: '24px' }}>
          <MarkdownRenderer content={q.content.stem} />
        </div>

        {/* Code template */}
        {q.type === 'programming' && q.content.code_template && (
          <pre style={{ background: '#F9FAFB', borderRadius: 12, padding: '16px', fontSize: '13px', fontFamily: 'monospace', marginBottom: '20px' }}>
            {q.content.code_template}
          </pre>
        )}

        {/* Type-specific input */}
        {q.type === 'single_choice' && q.content.options && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {q.content.options.map(opt => (
              <div key={opt.key} onClick={() => !submitted && setSelected(opt.key)}
                style={{
                  display: 'flex', alignItems: 'center', padding: '14px 16px',
                  background: selected === opt.key ? 'rgba(30,58,138,0.08)' : '#F9FAFB',
                  borderRadius: 12, border: selected === opt.key ? '2px solid #1E3A8A' : '2px solid transparent',
                  cursor: submitted ? 'default' : 'pointer', transition: 'all 0.15s',
                }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: selected === opt.key ? '#1E3A8A' : '#E5E7EB',
                  color: selected === opt.key ? '#fff' : '#6B7280',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: 600, marginRight: '12px', flexShrink: 0,
                }}>
                  {opt.key}
                </div>
                <span style={{ fontSize: '15px', color: '#374151' }}><MarkdownRenderer content={opt.text} /></span>
              </div>
            ))}
          </div>
        )}

        {q.type === 'multiple_choice' && q.content.options && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {q.content.options.map(opt => {
              const isSel = selectedMulti.includes(opt.key)
              return (
                <div key={opt.key} onClick={() => !submitted && toggleMulti(opt.key)}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '14px 16px',
                    background: isSel ? 'rgba(30,58,138,0.08)' : '#F9FAFB',
                    borderRadius: 12, border: isSel ? '2px solid #1E3A8A' : '2px solid transparent',
                    cursor: submitted ? 'default' : 'pointer',
                  }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: isSel ? '#1E3A8A' : '#E5E7EB',
                    color: isSel ? '#fff' : '#6B7280',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', fontWeight: 600, marginRight: '12px', flexShrink: 0,
                  }}>
                    {opt.key}
                  </div>
                  <span style={{ fontSize: '15px', color: '#374151' }}><MarkdownRenderer content={opt.text} /></span>
                </div>
              )
            })}
          </div>
        )}

        {(q.type === 'fill_blank' || q.type === 'short_answer') && (
          <div style={{ marginBottom: '20px' }}>
            <textarea value={textAnswer} onChange={e => setTextAnswer(e.target.value)}
              placeholder="请输入答案" disabled={submitted}
              style={{ width: '100%', minHeight: 80, padding: '14px', border: '2px solid #E5E7EB', borderRadius: 12, fontSize: '15px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', background: submitted ? '#F9FAFB' : '#fff' }} />
          </div>
        )}

        {q.type === 'true_false' && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            {['对', '错'].map(v => (
              <div key={v} onClick={() => !submitted && setSelected(v)}
                style={{
                  flex: 1, padding: '16px', textAlign: 'center',
                  background: selected === v ? 'rgba(30,58,138,0.08)' : '#F9FAFB',
                  borderRadius: 12, border: selected === v ? '2px solid #1E3A8A' : '2px solid transparent',
                  cursor: submitted ? 'default' : 'pointer', fontSize: '16px', fontWeight: 500, color: '#374151',
                }}>
                {v}
              </div>
            ))}
          </div>
        )}

        {q.type === 'essay' && (
          <div style={{ marginBottom: '20px' }}>
            <textarea value={textAnswer} onChange={e => setTextAnswer(e.target.value)}
              placeholder="请输入你的解答" disabled={submitted}
              style={{ width: '100%', minHeight: 150, padding: '14px', border: '2px solid #E5E7EB', borderRadius: 12, fontSize: '15px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', background: submitted ? '#F9FAFB' : '#fff' }} />
          </div>
        )}

        {/* Submit / Result */}
        {submitted ? (
          <div>
            <div style={{
              padding: '14px 18px', borderRadius: 12, marginBottom: '12px',
              background: isCorrect ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color: isCorrect ? '#10B981' : '#EF4444', fontSize: '15px', fontWeight: 600,
            }}>
              {hideAnswer
                ? (isCorrect ? '✓ 已记录（正确）' : '✗ 已记录（错误）')
                : (isCorrect ? '✓ 回答正确！' : '✗ 回答错误')}
            </div>
            {!hideAnswer && q.answer?.explanation && (
              <div style={{ padding: '14px 18px', borderRadius: 12, marginBottom: '12px', background: '#F9FAFB', fontSize: '14px', color: '#6B7280', lineHeight: 1.7 }}>
                <div style={{ fontWeight: 600, color: '#374151', marginBottom: '4px' }}>解析</div>
                <MarkdownRenderer content={q.answer.explanation} />
              </div>
            )}
            {!hideAnswer && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={reset}
                  style={{ flex: 1, padding: '12px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 12, fontSize: '14px', cursor: 'pointer' }}>
                  重新作答
                </button>
                {!isCorrect && (
                  <button onClick={onAskAI}
                    style={{ flex: 1, padding: '12px', background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: 12, fontSize: '14px', cursor: 'pointer' }}>
                    💬 问AI
                  </button>
                )}
              </div>
            )}
            {hideAnswer && (
              <div style={{ padding: '10px 14px', borderRadius: 12, background: '#F9FAFB', fontSize: '13px', color: '#9CA3AF', textAlign: 'center' }}>
                答案将在交卷后揭晓
              </div>
            )}
          </div>
        ) : (
          <button onClick={handleSubmit} disabled={readonly}
            style={{ width: '100%', padding: '14px', background: readonly ? '#D1D5DB' : '#1E3A8A', color: '#fff', border: 'none', borderRadius: 12, fontSize: '15px', fontWeight: 500, cursor: readonly ? 'default' : 'pointer' }}>
            {readonly ? '已完成' : '提交答案'}
          </button>
        )}
      </div>

      {/* AI Chat floating button */}
      <button onClick={onAskAI}
        style={{
          position: 'fixed', right: '24px', bottom: '120px',
          width: '56px', height: '56px', borderRadius: '50%',
          background: '#1E3A8A', color: '#fff', border: 'none',
          fontSize: '24px', cursor: 'pointer', zIndex: 100,
          boxShadow: '0 4px 16px rgba(30,58,138,0.3)',
        }}>
        💬
      </button>
    </div>
  )
}
