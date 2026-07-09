import { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import { AlertTriangleIcon, CheckIcon, CloseIcon, MessageCircleIcon } from './Icons'

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
  difficulty: string
  tags: string[]
}

const QTYPE_LABELS: Record<string, string> = {
  single_choice: '单选题', multiple_choice: '多选题', fill_blank: '填空题',
  true_false: '判断题', short_answer: '简答题', programming: '编程题', essay: '论述题',
}
const DIFF_LABELS: Record<string, string> = {
  beginner: '入门', basic: '基础', intermediate: '进阶', advanced: '挑战', competition: '竞赛',
}
const DIFF_COLORS: Record<string, string> = {
  beginner: 'var(--app-success)', basic: 'var(--app-info)', intermediate: 'var(--app-warning)', advanced: 'var(--app-danger)', competition: 'var(--app-purple)',
}

const QuestionCard = forwardRef<any, {
  question: PracticeQuestion
  onSubmit: (answer: string, isCorrect: boolean, skipBackend?: boolean) => void
  onAskAI: () => void
  readonly?: boolean
  hideAnswer?: boolean
  savedAnswer?: { answerContent: string; isCorrect: boolean } | null
  examMode?: boolean
}>(function QuestionCard({
  question, onSubmit, onAskAI, readonly, hideAnswer, savedAnswer, examMode,
}, ref) {
  const q = question

  const initSelected = savedAnswer ? (() => {
    if (q.type === 'single_choice' || q.type === 'true_false' || (q.type === 'programming' && q.content.options?.length)) return savedAnswer.answerContent
    return ''
  })() : ''
  const initMulti = savedAnswer && q.type === 'multiple_choice' ? savedAnswer.answerContent.split(',').filter(Boolean) : []
  const initText = savedAnswer && !['single_choice', 'multiple_choice', 'true_false'].includes(q.type) && !(q.type === 'programming' && q.content.options?.length) ? savedAnswer.answerContent : ''
  const [selected, setSelected] = useState(initSelected)
  const [selectedMulti, setSelectedMulti] = useState<string[]>(initMulti)
  const [textAnswer, setTextAnswer] = useState(initText)
  const [submitted, setSubmitted] = useState(!!savedAnswer && !examMode)
  const [isCorrect, setIsCorrect] = useState(savedAnswer?.isCorrect || false)
  const [submitError, setSubmitError] = useState('')
  const latestAnswerRef = useRef('')  // 实时追踪最新选择，不受 React 异步状态更新影响
  const diffLabel = DIFF_LABELS[q.difficulty] || q.difficulty
  const diffColor = DIFF_COLORS[q.difficulty] || 'var(--app-text-secondary)'

  // Sync state when question changes
  useEffect(() => {
    if (savedAnswer) {
      const raw = savedAnswer.answerContent
      if (q.type === 'single_choice' || q.type === 'true_false' || (q.type === 'programming' && q.content.options?.length)) {
        setSelected(raw); setSelectedMulti([]); setTextAnswer('')
      } else if (q.type === 'multiple_choice') {
        setSelectedMulti(raw.split(',').filter(Boolean)); setSelected(''); setTextAnswer('')
      } else {
        setTextAnswer(raw); setSelected(''); setSelectedMulti([])
      }
      // 考试模式/测后看答案：不显示提交结果，只恢复选项选择
      if (!examMode) {
        setSubmitted(true)
        setIsCorrect(savedAnswer.isCorrect)
      }
    } else {
      setSelected(''); setSelectedMulti([]); setTextAnswer('')
      setSubmitted(false); setIsCorrect(false)
      setSubmitError('')
    }
  }, [question.id, savedAnswer, examMode, q.type])

  const checkAnswer = (userAns: string): boolean => {
    let correct = q.answer?.correct_answer
    // Handle both array ["C"] and string "C" formats
    if (!Array.isArray(correct)) {
      correct = correct ? [String(correct)] : []
    }
    if (!correct.length) return false
    if (q.type === 'multiple_choice') {
      const userArr = userAns.split(',').map(s => s.trim().toUpperCase()).sort()
      const correctArr = correct.map(s => s.trim().toUpperCase()).sort()
      return userArr.length === correctArr.length && userArr.every((v, i) => v === correctArr[i])
    }
    if (q.type === 'fill_blank' || q.type === 'programming') {
      const normalizeText = (value: string) =>
        value.trim().toUpperCase().replace(/[，、；;]/g, ',').replace(/\s+/g, '')
      const user = normalizeText(userAns)
      return correct.some(c => normalizeText(c) === user)
    }
    const user = userAns.trim().toUpperCase()
    return correct.some(c => c.trim().toUpperCase() === user)
  }

  const getCurrentAnswer = useCallback((): string => {
    const fromState = (() => {
      if (q.type === 'single_choice') return selected
      if (q.type === 'programming' && q.content.options?.length) return selected
      if (q.type === 'multiple_choice') return selectedMulti.sort().join(',')
      if (q.type === 'true_false') return selected
      return textAnswer
    })()
    // 如果 state 有值则用 state（避免使用 ref 的过期值），否则 fallback 到 ref
    return fromState || latestAnswerRef.current
  }, [q.type, selected, selectedMulti, textAnswer])

  const handleSubmit = () => {
    const answer = getCurrentAnswer()
    if (!answer.trim()) {
      setSubmitError('请先选择一个答案')
      return
    }
    setSubmitError('')
    const correct = checkAnswer(answer)
    setIsCorrect(correct)
    setSubmitted(true)
    onSubmit(answer, correct)
  }

  const submitSilent = useCallback((showResult = false) => {
    const answer = getCurrentAnswer()
    if (!answer.trim()) return
    const correct = checkAnswer(answer)
    if (showResult) {
      setIsCorrect(correct)
      setSubmitted(true)
    }
    onSubmit(answer, correct, !showResult)  // showResult → skipBackend: true=提交结果且提交后端, false=仅本地保存
  }, [getCurrentAnswer, onSubmit, q.answer?.correct_answer])

  useImperativeHandle(ref, () => ({
    submitSilent,
    getCurrentAnswer,
  }), [getCurrentAnswer, submitSilent])

  const toggleMulti = (key: string) => {
    setSelectedMulti(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      latestAnswerRef.current = next.sort().join(',')
      return next
    })
  }

  const handleSelect = (val: string) => {
    latestAnswerRef.current = val
    setSelected(val)
    setSubmitError('')
  }

  const clearError = () => { if (submitError) setSubmitError('') }

  const reset = () => {
    setSelected(''); setSelectedMulti([]); setTextAnswer(''); setSubmitted(false); setSubmitError('')
  }

  const isDisabled = submitted && !examMode

  return (
    <div>
      <div className="card-hover" style={{
        background: '#fff', borderRadius: 16, padding: '24px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)', marginBottom: '12px',
      }}>
        {/* Tags row */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', padding: '3px 14px', borderRadius: 12, background: 'rgba(30,58,138,0.1)', color: 'var(--app-brand)', fontWeight: 500 }}>
            {QTYPE_LABELS[q.type] || q.type}
          </span>
          <span style={{ fontSize: '12px', padding: '3px 14px', borderRadius: 12, background: `${diffColor}18`, color: diffColor, fontWeight: 500 }}>
            {diffLabel}
          </span>
          {q.tags?.map(t => (
            <span key={t} style={{
              fontSize: '11px', padding: '2px 8px', borderRadius: 10,
              background: t === '易错' ? 'rgba(239,68,68,0.15)' : 'transparent',
              color: t === '易错' ? 'var(--app-danger)' : 'var(--app-text-muted)',
              fontWeight: t === '易错' ? 600 : 400,
            }}>
              {t === '易错' ? <><AlertTriangleIcon size={11} /> 易错</> : `#${t}`}
            </span>
          ))}
        </div>

        {/* Question stem */}
        <div style={{ fontSize: '16px', lineHeight: 1.8, color: 'var(--app-text-heading)', marginBottom: '24px' }}>
          <MarkdownRenderer content={q.content.stem} />
        </div>

        {q.type === 'programming' && q.content.code_template && (
          <pre style={{ background: 'var(--app-bg-card-alt)', borderRadius: 12, padding: '16px', fontSize: '13px', fontFamily: 'monospace', marginBottom: '20px' }}>
            {q.content.code_template}
          </pre>
        )}

        {q.type === 'programming' && q.content.options && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {q.content.options.map(opt => (
              <div key={opt.key} onClick={() => { if (!isDisabled) handleSelect(opt.key); }}
                style={{
                  display: 'flex', alignItems: 'center', padding: '14px 16px',
                  background: selected === opt.key ? 'rgba(30,58,138,0.08)' : 'var(--app-bg-card-alt)',
                  borderRadius: 12, border: selected === opt.key ? '2px solid #1E3A8A' : '2px solid transparent',
                  cursor: isDisabled ? 'default' : 'pointer', transition: 'all 0.15s',
                }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: selected === opt.key ? 'var(--app-brand)' : 'var(--app-border)',
                  color: selected === opt.key ? '#fff' : 'var(--app-text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: 600, marginRight: '12px', flexShrink: 0,
                }}>
                  {opt.key}
                </div>
                <span style={{ fontSize: '15px', color: 'var(--app-text-body)' }}><MarkdownRenderer content={opt.text} /></span>
              </div>
            ))}
          </div>
        )}

        {q.type === 'programming' && !q.content.options && (
          <div style={{ marginBottom: '20px' }}>
            <textarea value={textAnswer} onChange={e => { latestAnswerRef.current = e.target.value; setTextAnswer(e.target.value); clearError(); }}
              placeholder="请输入代码空白处应填内容" disabled={isDisabled}
              style={{ width: '100%', minHeight: 96, padding: '14px', border: '2px solid #E5E7EB', borderRadius: 12, fontSize: '15px', outline: 'none', resize: 'vertical', fontFamily: 'monospace', background: isDisabled ? 'var(--app-bg-card-alt)' : '#fff' }} />
          </div>
        )}

        {/* single choice */}
        {q.type === 'single_choice' && q.content.options && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {q.content.options.map(opt => (
              <div key={opt.key} onClick={() => { if (!isDisabled) handleSelect(opt.key); }}
                style={{
                  display: 'flex', alignItems: 'center', padding: '14px 16px',
                  background: selected === opt.key ? 'rgba(30,58,138,0.08)' : 'var(--app-bg-card-alt)',
                  borderRadius: 12, border: selected === opt.key ? '2px solid #1E3A8A' : '2px solid transparent',
                  cursor: isDisabled ? 'default' : 'pointer', transition: 'all 0.15s',
                }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: selected === opt.key ? 'var(--app-brand)' : 'var(--app-border)',
                  color: selected === opt.key ? '#fff' : 'var(--app-text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: 600, marginRight: '12px', flexShrink: 0,
                }}>
                  {opt.key}
                </div>
                <span style={{ fontSize: '15px', color: 'var(--app-text-body)' }}><MarkdownRenderer content={opt.text} /></span>
              </div>
            ))}
          </div>
        )}

        {/* multiple choice */}
        {q.type === 'multiple_choice' && q.content.options && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {q.content.options.map(opt => {
              const isSel = selectedMulti.includes(opt.key)
              return (
                <div key={opt.key} onClick={() => { if (!isDisabled) { toggleMulti(opt.key); } }}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '14px 16px',
                    background: isSel ? 'rgba(30,58,138,0.08)' : 'var(--app-bg-card-alt)',
                    borderRadius: 12, border: isSel ? '2px solid #1E3A8A' : '2px solid transparent',
                    cursor: isDisabled ? 'default' : 'pointer',
                  }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: isSel ? 'var(--app-brand)' : 'var(--app-border)',
                    color: isSel ? '#fff' : 'var(--app-text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', fontWeight: 600, marginRight: '12px', flexShrink: 0,
                  }}>
                    {opt.key}
                  </div>
                  <span style={{ fontSize: '15px', color: 'var(--app-text-body)' }}><MarkdownRenderer content={opt.text} /></span>
                </div>
              )
            })}
          </div>
        )}

        {/* fill_blank / short_answer */}
        {(q.type === 'fill_blank' || q.type === 'short_answer') && (
          <div style={{ marginBottom: '20px' }}>
            <textarea value={textAnswer} onChange={e => { latestAnswerRef.current = e.target.value; setTextAnswer(e.target.value); clearError(); }}
              placeholder="请输入答案" disabled={isDisabled}
              style={{ width: '100%', minHeight: 80, padding: '14px', border: '2px solid #E5E7EB', borderRadius: 12, fontSize: '15px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', background: isDisabled ? 'var(--app-bg-card-alt)' : '#fff' }} />
          </div>
        )}

        {/* true_false */}
        {q.type === 'true_false' && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            {['对', '错'].map(v => (
              <div key={v} onClick={() => { if (!isDisabled) handleSelect(v); }}
                style={{
                  flex: 1, padding: '16px', textAlign: 'center',
                  background: selected === v ? 'rgba(30,58,138,0.08)' : 'var(--app-bg-card-alt)',
                  borderRadius: 12, border: selected === v ? '2px solid #1E3A8A' : '2px solid transparent',
                  cursor: isDisabled ? 'default' : 'pointer', fontSize: '16px', fontWeight: 500, color: 'var(--app-text-body)',
                }}>
                {v}
              </div>
            ))}
          </div>
        )}

        {/* essay */}
        {q.type === 'essay' && (
          <div style={{ marginBottom: '20px' }}>
            <textarea value={textAnswer} onChange={e => { latestAnswerRef.current = e.target.value; setTextAnswer(e.target.value); clearError(); }}
              placeholder="请输入你的解答" disabled={isDisabled}
              style={{ width: '100%', minHeight: 150, padding: '14px', border: '2px solid #E5E7EB', borderRadius: 12, fontSize: '15px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', background: isDisabled ? 'var(--app-bg-card-alt)' : '#fff' }} />
          </div>
        )}

        {/* Submit / Result — shown in both modes */}
        {submitted ? (
          <div>
            <div style={{
              padding: '14px 18px', borderRadius: 12, marginBottom: '12px',
              background: isCorrect ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color: isCorrect ? 'var(--app-success)' : 'var(--app-danger)', fontSize: '15px', fontWeight: 600,
            }}>
              {hideAnswer
                ? (isCorrect ? <><CheckIcon size={15} /> 已记录（正确）</> : <><CloseIcon size={15} color="#EF4444" /> 已记录（错误）</>)
                : (isCorrect ? <><CheckIcon size={15} /> 回答正确！</> : <><CloseIcon size={15} color="#EF4444" /> 回答错误</>)}
            </div>
            {!hideAnswer && q.answer?.explanation && (
              <div style={{ padding: '14px 18px', borderRadius: 12, marginBottom: '12px', background: 'var(--app-bg-card-alt)', fontSize: '14px', color: 'var(--app-text-secondary)', lineHeight: 1.7 }}>
                <div style={{ fontWeight: 600, color: 'var(--app-text-body)', marginBottom: '4px' }}>解析</div>
                <MarkdownRenderer content={q.answer.explanation} />
              </div>
            )}
            {!hideAnswer && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={reset}
                  style={{ flex: 1, padding: '12px', background: 'var(--app-bg-page)', color: 'var(--app-text-body)', border: 'none', borderRadius: 12, fontSize: '14px', cursor: 'pointer' }}>
                  重新作答
                </button>
                {!isCorrect && (
                  <button onClick={onAskAI}
                    style={{ flex: 1, padding: '12px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 12, fontSize: '14px', cursor: 'pointer' }}>
                    <MessageCircleIcon size={14} /> 问AI
                  </button>
                )}
              </div>
            )}
            {hideAnswer && (
              <div style={{ padding: '10px 14px', borderRadius: 12, background: 'var(--app-bg-card-alt)', fontSize: '13px', color: 'var(--app-text-muted)', textAlign: 'center' }}>
                答案将在交卷后揭晓
              </div>
            )}
          </div>
        ) : (
          <>
            {submitError && (
              <div style={{
                padding: '10px 14px', borderRadius: 12, marginBottom: '12px',
                background: 'rgba(239,68,68,0.1)', color: 'var(--app-danger)',
                fontSize: '13px', fontWeight: 500, textAlign: 'center',
              }}>
                ⚠ {submitError}
              </div>
            )}
            {!examMode && (
              <button onClick={handleSubmit} disabled={readonly}
                style={{ width: '100%', padding: '14px', background: readonly ? 'var(--app-text-placeholder)' : 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 12, fontSize: '15px', fontWeight: 500, cursor: readonly ? 'default' : 'pointer' }}>
                {readonly ? '已完成' : '提交答案'}
              </button>
            )}
          </>
        )}
      </div>

      <button onClick={onAskAI}
        style={{
          position: 'fixed', right: '24px', bottom: '120px',
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'var(--app-brand)', color: '#fff', border: 'none',
          fontSize: '24px', cursor: 'pointer', zIndex: 100,
          boxShadow: '0 4px 16px rgba(30,58,138,0.3)',
        }}>
        <MessageCircleIcon size={24} />
      </button>
    </div>
  )
})

export default QuestionCard
