interface Props {
  currentStep: number
  totalSteps: number
  onPrev: () => void
  onNext: () => void
  onAutoPlay: () => void
  isAutoPlaying: boolean
  disabled?: boolean
}

export default function StepController({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
  onAutoPlay,
  isAutoPlaying,
  disabled,
}: Props) {
  if (totalSteps === 0) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      padding: '12px 0 0',
      flexWrap: 'wrap',
    }}>
      <button type="button" onClick={onPrev} disabled={disabled || currentStep <= 1} style={btnStyle(disabled || currentStep <= 1)}>
        上一步
      </button>

      <span style={{ fontSize: 13, color: 'var(--app-text-secondary)', minWidth: 76, textAlign: 'center' }}>
        {currentStep}/{totalSteps}
      </span>

      <button type="button" onClick={onNext} disabled={disabled || currentStep >= totalSteps} style={btnStyle(disabled || currentStep >= totalSteps)}>
        下一步
      </button>

      <button
        type="button"
        onClick={onAutoPlay}
        disabled={disabled}
        style={{
          background: isAutoPlaying ? 'var(--app-danger)' : 'var(--app-primary)',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '6px 14px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 13,
          fontWeight: 700,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {isAutoPlaying ? '暂停' : '自动播放'}
      </button>
    </div>
  )
}

const btnStyle = (disabled?: boolean) => ({
  background: 'var(--app-bg-card)',
  border: '1px solid var(--app-border)',
  borderRadius: 6,
  padding: '6px 12px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 13,
  color: 'var(--app-text)',
  opacity: disabled ? 0.45 : 1,
})
