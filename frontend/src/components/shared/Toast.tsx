import { useEffect, useRef } from 'react'
import { useToastStore, type ToastType } from '../../store/toast'
import {
  CheckCircleIcon, XCircleIcon, InfoIcon, AlertTriangleIcon,
  CloseIcon,
} from '../Icons'

/* ─────────────────────────────────────────────
   Brand Colors for each toast type
   ───────────────────────────────────────────── */
const TYPE_STYLES: Record<ToastType, { bg: string; border: string; iconColor: string; textColor: string }> = {
  success: {
    bg: 'var(--toast-success-bg)',
    border: 'var(--toast-success-border)',
    iconColor: '#10B981',
    textColor: 'var(--toast-success-text)',
  },
  error: {
    bg: 'var(--toast-error-bg)',
    border: 'var(--toast-error-border)',
    iconColor: '#EF4444',
    textColor: 'var(--toast-error-text)',
  },
  info: {
    bg: 'var(--toast-info-bg)',
    border: 'var(--toast-info-border)',
    iconColor: '#3B82F6',
    textColor: 'var(--toast-info-text)',
  },
  warning: {
    bg: 'var(--toast-warning-bg)',
    border: 'var(--toast-warning-border)',
    iconColor: '#F59E0B',
    textColor: 'var(--toast-warning-text)',
  },
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircleIcon size={18} />,
  error: <XCircleIcon size={18} />,
  info: <InfoIcon size={18} />,
  warning: <AlertTriangleIcon size={18} />,
}

/* ═══════════════════════════════════════════════
   Single Toast Item
   ═══════════════════════════════════════════════ */
function ToastItem({ id, message, type, duration }: {
  id: string
  message: string
  type: ToastType
  duration: number
}) {
  const removeToast = useToastStore((s) => s.removeToast)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const style = TYPE_STYLES[type]

  const startTimer = () => {
    if (duration > 0) {
      timerRef.current = setTimeout(() => removeToast(id), duration)
    }
  }

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => {
    startTimer()
    return () => clearTimer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="toast-item"
      onMouseEnter={clearTimer}
      onMouseLeave={startTimer}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        borderRadius: 12,
        background: style.bg,
        border: `1px solid ${style.border}`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        minWidth: 280,
        maxWidth: 420,
        pointerEvents: 'auto',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Icon */}
      <div style={{ color: style.iconColor, flexShrink: 0, display: 'flex' }}>
        {ICONS[type]}
      </div>

      {/* Message */}
      <div style={{
        flex: 1,
        fontSize: '0.875rem',
        fontWeight: 500,
        color: style.textColor,
        lineHeight: 1.5,
        fontFamily: "'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif",
      }}>
        {message}
      </div>

      {/* Close button */}
      <button
        onClick={() => removeToast(id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          borderRadius: 6,
          border: 'none',
          background: 'transparent',
          color: style.textColor,
          opacity: 0.5,
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1'
          e.currentTarget.style.background = 'rgba(0,0,0,0.05)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.5'
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <CloseIcon size={14} />
      </button>

      {/* Progress bar (auto-dismiss timer) */}
      {duration > 0 && (
        <div className="toast-progress" style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 3,
          background: style.iconColor,
          opacity: 0.2,
          animation: `toastShrink ${duration}ms linear forwards`,
        }} />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Toast Container (rendered at app root)
   ═══════════════════════════════════════════════ */
export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(100%) scale(0.9); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes toastShrink {
          from { width: 100%; }
          to { width: 0%; }
        }
        .toast-item {
          animation: toastSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
      <div style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
      }}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} {...toast} />
        ))}
      </div>
    </>
  )
}
