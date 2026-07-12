import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { resourcesApi, type ResourceListItem } from '../api/resources'

interface PracticeRecommendPopoverProps {
  bankId: string
  wrongCount: number
  knowledgePoints: string[]
  sessionId: string
  onClose: () => void
}

export default function PracticeRecommendPopover({
  bankId,
  wrongCount,
  knowledgePoints,
  sessionId,
  onClose,
}: PracticeRecommendPopoverProps) {
  const navigate = useNavigate()
  const [codeResource, setCodeResource] = useState<ResourceListItem | null>(null)
  const [loading, setLoading] = useState(true)

  const storageKey = `practice_recommend_shown_${sessionId}`

  // Synchronous check: if already shown, don't render
  if (sessionStorage.getItem(storageKey) !== null) {
    return null
  }

  // Fetch code case resource on mount
  useEffect(() => {
    if (knowledgePoints.length === 0) {
      setLoading(false)
      return
    }

    resourcesApi
      .list({
        resource_type: 'code_case',
        knowledge_point: knowledgePoints[0],
      })
      .then((res) => {
        if (res.data.resources.length > 0) {
          setCodeResource(res.data.resources[0])
        }
      })
      .catch(() => {
        // silent — code case is optional, no error feedback needed
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const persistAndClose = () => {
    sessionStorage.setItem(storageKey, '1')
    onClose()
  }

  const handleGoToWrongReview = () => {
    sessionStorage.setItem(storageKey, '1')
    onClose()
    navigate(`/review`)
  }

  const handleGoToResource = () => {
    if (codeResource) {
      sessionStorage.setItem(storageKey, '1')
      onClose()
      navigate(`/resources/${codeResource.id}`)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Only close when clicking the overlay itself, not the popover card
    if (e.target === e.currentTarget) {
      persistAndClose()
    }
  }

  const firstKp = knowledgePoints[0] || ''

  return (
    <>
      {/* Transparent overlay — clicking outside the popover closes it */}
      <div
        onClick={handleOverlayClick}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          background: 'transparent',
        }}
      />

      {/* Popover card */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '320px',
          zIndex: 1000,
          animation: 'prSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '14px',
            boxShadow:
              '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px 10px',
            }}
          >
            <span
              style={{
                fontSize: '0.9375rem',
                fontWeight: 700,
                color: 'var(--app-text-heading)',
              }}
            >
              💡 练习推荐
            </span>
            <button
              onClick={persistAndClose}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '1rem',
                color: 'var(--app-text-muted)',
                padding: '2px 6px',
                lineHeight: 1,
                borderRadius: '4px',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--app-text-secondary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--app-text-muted)'
              }}
            >
              ✕
            </button>
          </div>

          {/* Wrong review section — red tone */}
          <div
            style={{
              margin: '0 12px 10px',
              padding: '12px 14px',
              background: '#FEF2F2',
              borderRadius: '10px',
            }}
          >
            <div
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--app-danger)',
                marginBottom: '4px',
              }}
            >
              📌 错题回顾
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--app-text-secondary)',
                marginBottom: '10px',
              }}
            >
              本次练习共 {wrongCount} 道错题
            </div>
            <button
              onClick={handleGoToWrongReview}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--app-danger)',
                padding: 0,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.8'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1'
              }}
            >
              去回顾 →
            </button>
          </div>

          {/* Code case recommendation section — amber tone (conditional) */}
          {!loading && codeResource && (
            <div
              style={{
                margin: '0 12px 14px',
                padding: '12px 14px',
                background: '#FFFBEB',
                borderRadius: '10px',
              }}
            >
              <div
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#D97706',
                  marginBottom: '4px',
                }}
              >
                💻 推荐代码实操
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--app-text-secondary)',
                  marginBottom: '10px',
                }}
              >
                知识点「{firstKp}」的代码案例
              </div>
              <button
                onClick={handleGoToResource}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#D97706',
                  padding: 0,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.8'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1'
                }}
              >
                查看案例 →
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes prSlideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  )
}
