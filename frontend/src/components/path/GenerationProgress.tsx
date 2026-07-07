/**
 * GenerationProgress — 路径生成四步进度动画
 *
 * 步骤：
 *   1. 正在分析你的学习画像...        (0-30%)
 *   2. 正在分析知识图谱结构...        (30-60%)
 *   3. 正在生成个性化学习路径...      (60-90%)
 *   4. 正在生成学习策略与建议...      (90-100%)
 *
 * 超时 30s 后显示 "路径规划比预期耗时更长" 提示
 * 失败时显示具体错误原因 + 重试按钮
 */
import { useEffect, useState, useRef } from 'react'

const STEPS = [
  { label: '正在分析你的学习画像...', icon: '🔍', progress: [0, 30] },
  { label: '正在分析知识图谱结构...', icon: '🧬', progress: [30, 60] },
  { label: '正在生成个性化学习路径...', icon: '✨', progress: [60, 90] },
  { label: '正在生成学习策略与建议...', icon: '📋', progress: [90, 100] },
]

const SLOW_THRESHOLD_MS = 30000
const COLOR_BRAND = '#1677E8'

interface Props {
  /** 是否正在生成 */
  active: boolean
  /** 错误信息（null 表示正常） */
  error: string | null
  /** 重试回调 */
  onRetry?: () => void
  /** 取消回调 */
  onCancel?: () => void
}

export default function GenerationProgress({ active, error, onRetry, onCancel }: Props) {
  const [stepIndex, setStepIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isSlow, setIsSlow] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!active) {
      // Reset
      setStepIndex(0)
      setProgress(0)
      setIsSlow(false)
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      if (slowTimerRef.current) { clearTimeout(slowTimerRef.current); slowTimerRef.current = null }
      return
    }

    // Start animation
    let currentStep = 0
    let currentProgress = 0

    timerRef.current = setInterval(() => {
      const step = STEPS[currentStep]
      const [start, end] = step.progress

      // Increment progress within current step
      currentProgress += 1.5 + Math.random() * 3
      if (currentProgress >= end) {
        currentProgress = end
        // Move to next step
        if (currentStep < STEPS.length - 1) {
          currentStep++
          setStepIndex(currentStep)
        }
      }
      setProgress(Math.min(100, Math.round(currentProgress)))
    }, 400)

    // Slow detection
    slowTimerRef.current = setTimeout(() => setIsSlow(true), SLOW_THRESHOLD_MS)

    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      if (slowTimerRef.current) { clearTimeout(slowTimerRef.current); slowTimerRef.current = null }
    }
  }, [active])

  if (error) {
    return (
      <div style={{
        background: '#FEF2F2', borderRadius: 14, border: '1px solid #FECACA',
        padding: 28, textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>❌</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#991B1B', marginBottom: 4 }}>路径生成失败</div>
        <div style={{ fontSize: 12, color: '#7F1D1D', marginBottom: 16, lineHeight: 1.6 }}>
          {error}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {onRetry && (
            <button onClick={onRetry}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                background: COLOR_BRAND, color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500,
              }}>
              🔄 重试
            </button>
          )}
          {onCancel && (
            <button onClick={onCancel}
              style={{
                padding: '8px 20px', borderRadius: 8, border: '1px solid #D1D5DB',
                background: '#fff', color: '#6B7280', fontSize: 13, cursor: 'pointer',
              }}>
              取消
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!active) return null

  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB',
      padding: 28, textAlign: 'center',
      animation: 'fadeUp 0.3s ease-out',
    }}>
      {/* Current step icon + label */}
      <div style={{ fontSize: 36, marginBottom: 12 }}>
        {STEPS[stepIndex].icon}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#1F2937', marginBottom: 16 }}>
        {STEPS[stepIndex].label}
      </div>

      {/* Progress bar */}
      <div style={{
        height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden',
        marginBottom: 12, maxWidth: 400, margin: '0 auto 12px',
      }}>
        <div style={{
          height: '100%', borderRadius: 4,
          background: `linear-gradient(90deg, ${COLOR_BRAND}, #38BDF8)`,
          width: `${progress}%`,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Step indicators */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
        {STEPS.map((step, i) => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: i < stepIndex ? '#10B981' : i === stepIndex ? COLOR_BRAND : '#D1D5DB',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>
      <div style={{ fontSize: 12, color: '#9CA3AF' }}>
        {progress}%
      </div>

      {/* Slow warning */}
      {isSlow && (
        <div style={{
          marginTop: 16, padding: '10px 16px', borderRadius: 8,
          background: '#FFFBEB', border: '1px solid #FCD34D',
          fontSize: 12, color: '#92400E', lineHeight: 1.6,
        }}>
          ⏳ 路径规划比预期耗时更长，因为系统正在分析你的完整学习画像...
          请耐心等待，或稍后重试。
        </div>
      )}

      {/* Cancel button */}
      {onCancel && (
        <button onClick={onCancel}
          style={{
            marginTop: 16, padding: '6px 16px', borderRadius: 8,
            border: '1px solid #E5E7EB', background: '#fff',
            color: '#6B7280', fontSize: 12, cursor: 'pointer',
          }}>
          取消生成
        </button>
      )}
    </div>
  )
}
