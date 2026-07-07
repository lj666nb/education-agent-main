/**
 * LearningStyleModal — 3题快速学习风格评估弹窗
 *
 * 触发时机：用户点击"生成学习路径"后，系统检测到无认知风格数据时自动弹出
 * 题目设计：
 *   Q1: 学习新知识时你更偏好？ → 映射认知风格 (visual/auditory/reading_writing/kinesthetic)
 *   Q2: 复习时你通常？ → 补充 multimodal_preference
 *   Q3: 哪个时间段学习效率最高？ → 映射 active_hours
 */
import { useState } from 'react'
import { pathApi } from '../../api/path'

const COLOR_BRAND = '#1677E8'

const QUESTIONS = [
  {
    id: 'q1',
    title: '学习新知识时你更偏好？',
    options: [
      { value: 'video', label: '📹 看视频讲解', emoji: '📹' },
      { value: 'doc', label: '📄 阅读文档 / 教材', emoji: '📄' },
      { value: 'practice', label: '✍️ 动手做练习', emoji: '✍️' },
      { value: 'audio', label: '🎧 听音频 / 讲解', emoji: '🎧' },
      { value: 'unknown', label: '🤷 不确定', emoji: '🤷' },
    ],
  },
  {
    id: 'q2',
    title: '复习时你通常？',
    options: [
      { value: 'mindmap', label: '🗺️ 画思维导图 / 图表', emoji: '🗺️' },
      { value: 'exercise', label: '📝 做练习题', emoji: '📝' },
      { value: 'notes', label: '📋 整理笔记 / 文字总结', emoji: '📋' },
      { value: 'discuss', label: '💬 口头复述 / 讨论', emoji: '💬' },
      { value: 'unknown', label: '🤷 不确定', emoji: '🤷' },
    ],
  },
  {
    id: 'q3',
    title: '哪个时间段学习效率最高？',
    options: [
      { value: 'morning', label: '🌅 早上 (6:00-12:00)', emoji: '🌅' },
      { value: 'afternoon', label: '☀️ 下午 (12:00-18:00)', emoji: '☀️' },
      { value: 'evening', label: '🌙 晚上 (18:00-24:00)', emoji: '🌙' },
      { value: 'night', label: '🌃 深夜 (0:00-6:00)', emoji: '🌃' },
      { value: 'unknown', label: '🤷 不确定', emoji: '🤷' },
    ],
  },
]

interface Props {
  /** 是否显示弹窗 */
  open: boolean
  /** 提交完成后回调 — 返回评估结果供父组件继续路径生成 */
  onComplete: (result: { cognitive_style: string; message: string }) => void
  /** 关闭弹窗（用户点击 X 或取消） */
  onClose: () => void
}

export default function LearningStyleModal({ open, onComplete, onClose }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [currentStep, setCurrentStep] = useState(0)

  const handleSelect = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
    setError('')
  }

  const handleSubmit = async () => {
    // 确保所有题目已答（可选"不确定"）
    const allAnswered = QUESTIONS.every(q => answers[q.id])
    if (!allAnswered) {
      setError('请回答所有问题（可选择"不确定"）')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await pathApi.submitStyleAssessment({
        q1: answers.q1,
        q2: answers.q2,
        q3: answers.q3,
      })
      onComplete(res.data)
    } catch (err: any) {
      const detail = err.response?.data?.detail
      setError(detail || '评估提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!submitting) onClose()
  }

  if (!open) return null

  const allAnswered = QUESTIONS.every(q => answers[q.id])
  const currentQuestion = QUESTIONS[currentStep]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1001,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)',
    }} onClick={handleClose}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 32, width: 460, maxWidth: '92vw',
        boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
        animation: 'fadeUp 0.3s ease-out',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
          <h3 style={{
            fontSize: 18, fontWeight: 700, color: '#1F2937',
            margin: '0 0 4px', fontFamily: "'Noto Sans SC', sans-serif",
          }}>
            个性化你的学习体验
          </h3>
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
            为了更好地为你规划学习路径，请回答 3 个简单问题（约 10 秒）
          </p>
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          {QUESTIONS.map((q, i) => (
            <div key={q.id} style={{
              width: i === currentStep ? 28 : 12, height: 12, borderRadius: 6,
              background: answers[q.id] ? '#10B981' : i === currentStep ? COLOR_BRAND : '#D1D5DB',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        {/* Question */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 14, fontWeight: 600, color: '#1F2937', marginBottom: 12,
            fontFamily: "'Noto Sans SC', sans-serif",
          }}>
            {currentQuestion.title}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {currentQuestion.options.map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  handleSelect(currentQuestion.id, opt.value)
                  // 自动前进到下一题（若选择"不确定"则延迟稍短）
                  if (currentStep < QUESTIONS.length - 1) {
                    setTimeout(() => setCurrentStep(s => s + 1), 200)
                  }
                }}
                style={{
                  padding: '10px 16px', borderRadius: 10, border: `1.5px solid ${answers[currentQuestion.id] === opt.value ? COLOR_BRAND : '#E5E7EB'}`,
                  background: answers[currentQuestion.id] === opt.value ? '#F0F9FF' : '#fff',
                  cursor: 'pointer', textAlign: 'left', fontSize: 13,
                  color: answers[currentQuestion.id] === opt.value ? COLOR_BRAND : '#374151',
                  fontWeight: answers[currentQuestion.id] === opt.value ? 600 : 400,
                  transition: 'all 0.15s',
                  fontFamily: "'Noto Sans SC', sans-serif",
                }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <button
            onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            style={{
              padding: '4px 12px', borderRadius: 6, border: 'none',
              background: currentStep === 0 ? 'transparent' : '#F3F4F6',
              color: currentStep === 0 ? 'transparent' : '#6B7280',
              fontSize: 12, cursor: currentStep === 0 ? 'default' : 'pointer',
            }}>
            ← 上一题
          </button>
          {currentStep < QUESTIONS.length - 1 && (
            <button
              onClick={() => setCurrentStep(s => Math.min(QUESTIONS.length - 1, s + 1))}
              disabled={!answers[currentQuestion.id]}
              style={{
                padding: '4px 12px', borderRadius: 6, border: 'none',
                background: answers[currentQuestion.id] ? '#F3F4F6' : 'transparent',
                color: answers[currentQuestion.id] ? '#6B7280' : 'transparent',
                fontSize: 12, cursor: answers[currentQuestion.id] ? 'pointer' : 'default',
              }}>
              下一题 →
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '8px 12px', borderRadius: 8, background: '#FEF2F2',
            border: '1px solid #FECACA', fontSize: 12, color: '#991B1B',
            marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
          style={{
            width: '100%', padding: '12px', borderRadius: 10, border: 'none',
            background: allAnswered && !submitting ? COLOR_BRAND : '#D1D5DB',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: allAnswered && !submitting ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all 0.2s',
            fontFamily: "'Noto Sans SC', sans-serif",
          }}>
          {submitting ? (
            <>⏳ 提交中...</>
          ) : (
            <>✨ 开始生成路径</>
          )}
        </button>

        {/* Close button */}
        <button onClick={handleClose}
          style={{
            marginTop: 8, width: '100%', padding: '6px', borderRadius: 8,
            border: 'none', background: 'transparent', color: '#9CA3AF',
            fontSize: 12, cursor: 'pointer',
            fontFamily: "'Noto Sans SC', sans-serif",
          }}>
          跳过（使用默认设置）
        </button>
      </div>
    </div>
  )
}
